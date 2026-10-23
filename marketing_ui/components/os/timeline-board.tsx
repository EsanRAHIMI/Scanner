'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { OwnerInput } from '@/components/os/fields';
import { useSession } from '@/components/os/session';
import { TimelineDrawer } from '@/components/os/timeline-drawer';
import { Avatar, ErrorBox, FilterSelect, Pill, Segmented, Skeleton, Toast, cx } from '@/components/os/ui';
import { api, invalidate, useApi, usePersisted } from '@/lib/os/client';
import { refreshAfterWrite } from '@/lib/os/data';
import { meLabel, shortDate } from '@/lib/os/model';
import {
  ACTIVITY_STATUSES,
  EMPTY_FOCUS,
  activityMatches,
  addDays,
  addMonths,
  barBox,
  barTone,
  buildScale,
  focusActive,
  hoursLabel,
  localClock,
  localToday,
  nowX,
  participation,
  stackRows,
  subTicks,
  type TimelineActivity,
  type TimelineFocus,
  type TimelinePayload,
  type Zoom,
} from '@/lib/os/timeline';
import { useUrlState } from '@/lib/os/url';

const LABEL = 156;
const BAR_H = 28;
const ROW_GAP = 4;
const MAX_COLLAPSED = 3;

function refreshAll() {
  invalidate('timeline');
  refreshAfterWrite('campaign');
  refreshAfterWrite('content');
  refreshAfterWrite('initiative');
  refreshAfterWrite('task');
}

export function TimelineBoard() {
  const { data, error, reload, mutate } = useApi<TimelinePayload>('timeline');
  const { me, isAdmin } = useSession();
  const { params, update } = useUrlState();
  const [zoom, setZoom] = usePersisted<Zoom>('tl-zoom', 'week');
  const [cursor, setCursor] = usePersisted('tl-cursor', '');
  const [focus, setFocus] = usePersisted<TimelineFocus>('tl-focus', EMPTY_FOCUS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [createLane, setCreateLane] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [managing, setManaging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; lane: string; start: string; end: string | null; dx: number } | null>(null);
  const [confirm, setConfirm] = useState<{ item: TimelineActivity; start: string; end: string | null } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource('/api/os/timeline/live');
    source.onmessage = (event) => {
      try {
        mutate(JSON.parse(event.data) as TimelinePayload);
      } catch {
        /* ping or partial */
      }
    };
    return () => source.close();
  }, [mutate]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const today = now ? localToday(now) : data?.today ?? '';
  const origin = useMemo(() => {
    const raw = cursor || today;
    if (!raw) return '';
    if (!now) return raw;
    const candidate = buildScale(raw, zoom);
    return nowX(candidate, now) == null ? today : raw;
  }, [cursor, today, zoom, now]);
  const scale = useMemo(() => (origin ? buildScale(origin, zoom) : null), [origin, zoom]);
  const openId = params.get('tl');

  const grouped = useMemo(() => {
    if (!data) return [];
    const stacked = new Map<string, TimelineActivity[]>();
    for (const item of data.activities) {
      stacked.set(item.lane_id, [...(stacked.get(item.lane_id) ?? []), item]);
    }
    return data.lanes.map((lane) => ({ lane, items: stacked.get(lane.id) ?? [] }));
  }, [data]);

  const focusing = focusActive(focus);
  const openItem = useMemo(() => {
    if (!data || !openId) return null;
    return [...data.activities, ...data.unscheduled].find((item) => item.id === openId) ?? null;
  }, [data, openId]);

  function scrollToNow(nextScale = scale, instant = false) {
    const node = scroller.current;
    const at = now ?? new Date();
    if (!node || !nextScale) return;
    const x = nowX(nextScale, at);
    if (x == null) return;
    const left = Math.max(0, x - Math.max(80, (node.clientWidth - LABEL) * 0.35));
    node.scrollTo({ left, behavior: instant ? 'auto' : 'smooth' });
  }

  function focusNow(nextZoom = zoom, instant = false) {
    const day = localToday(now ?? new Date());
    const from = cursor || day;
    const candidate = buildScale(from, nextZoom);
    const keep = nowX(candidate, now ?? new Date()) == null ? day : from;
    setCursor(keep);
    const nextScale = buildScale(keep, nextZoom);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToNow(nextScale, instant));
    });
  }

  function goToday() {
    const day = localToday(now ?? new Date());
    setCursor(day);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToNow(buildScale(day, zoom), false));
    });
  }

  function changeZoom(next: Zoom) {
    setZoom(next);
    focusNow(next, true);
  }

  function shift(dir: number) {
    if (!origin) return;
    if (zoom === 'month') setCursor(addMonths(origin, dir));
    else setCursor(addDays(origin, dir * (zoom === 'day' ? 7 : 28)));
  }

  async function createInLane(laneId: string) {
    const title = createTitle.trim();
    if (!title) return;
    try {
      const created = await api<TimelineActivity>('timeline/activities', {
        method: 'POST',
        json: { lane_id: laneId, title, start: localToday(now ?? new Date()), end: localToday(now ?? new Date()), owner: meLabel(me), status: 'Planned' },
      });
      setCreateTitle('');
      setCreateLane(null);
      refreshAll();
      update({ tl: created.id });
    } catch (err) {
      setToast((err as Error).message);
    }
  }

  const onBarPointer = useCallback(
    (item: TimelineActivity, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || window.matchMedia('(pointer: coarse)').matches) return;
      if (!item.start) return;
      const originX = event.clientX;
      const start = item.start;
      const end = item.end;
      const pointerId = event.pointerId;
      event.currentTarget.setPointerCapture(pointerId);
      setDragging({ id: item.id, lane: item.lane_id, start, end, dx: 0 });
      function move(next: PointerEvent) {
        setDragging((current) => (current ? { ...current, dx: next.clientX - originX } : current));
      }
      function up(next: PointerEvent) {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const shiftDays = Math.round((next.clientX - originX) / (scale?.pxPerDay || 12));
        setDragging(null);
        if (!shiftDays) return;
        setConfirm({ item, start: addDays(start, shiftDays), end: end ? addDays(end, shiftDays) : null });
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [scale],
  );

  async function applyMove() {
    if (!confirm) return;
    try {
      await api(`timeline/activities/${encodeURIComponent(confirm.item.id)}`, {
        method: 'PATCH',
        json: { start: confirm.start, end: confirm.end, expected_updated_at: confirm.item.updated_at },
      });
      setConfirm(null);
      refreshAll();
      setToast('Dates updated.');
    } catch (err) {
      setToast((err as Error).message);
      void reload();
    }
  }

  const didCenter = useRef(false);
  useLayoutEffect(() => {
    if (!scale || !now || !scroller.current) return;
    if (didCenter.current) return;
    didCenter.current = true;
    scrollToNow(scale, true);
  }, [scale, now]);

  useLayoutEffect(() => {
    if (!didCenter.current || !scale || !now) return;
    scrollToNow(scale, true);
  }, [zoom]);

  if (error && !data) return <ErrorBox message={error.message} onRetry={() => void reload()} />;
  if (!data || !scale) {
    return (
      <div className="os-panel overflow-hidden" aria-busy="true">
        <Skeleton className="h-72" />
      </div>
    );
  }

  const nowLeft = now ? nowX(scale, now) : null;
  const clock = now ? localClock(now) : '';
  const marks = subTicks(scale, zoom);
  const headerH = zoom === 'month' ? 44 : 62;

  return (
    <section className="os-panel min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-[13px] font-semibold text-brand-black">Live operations</h2>
          <p className="text-[11px] text-brand-dark-gray">One lane per area. Overlapping work stacks in place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented value={zoom} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} onChange={changeZoom} size="sm" label="Zoom" />
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => shift(-1)} aria-label="Earlier">
            ‹
          </button>
          <button type="button" className="btn-outline px-2.5 py-1 text-xs" onClick={goToday}>
            Today
          </button>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => shift(1)} aria-label="Later">
            ›
          </button>
          {isAdmin ? (
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setManaging((value) => !value)}>
              Lanes
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-black/5 px-3 py-2 sm:px-4">
        <label className={cx('os-filter max-w-[12rem]', focus.people.length > 0 && 'os-filter-on')}>
          <span className="sr-only">Person</span>
          <select
            value=""
            onChange={(event) => {
              const name = event.target.value;
              if (!name || focus.people.includes(name)) return;
              setFocus({ ...focus, people: [...focus.people, name] });
            }}
          >
            <option value="">Person</option>
            {data.people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {focus.people.map((name) => (
          <button key={name} type="button" className="inline-flex items-center gap-1 rounded-full bg-brand-burgundy/10 py-0.5 pl-0.5 pr-2 text-xs font-medium text-brand-burgundy" onClick={() => setFocus({ ...focus, people: focus.people.filter((item) => item !== name) })}>
            <Avatar name={name} />
            {name}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        <FilterSelect label="Area" value={focus.team} options={data.groups.map((item) => ({ value: item.id, label: item.name }))} onChange={(team) => setFocus({ ...focus, team })} />
        <FilterSelect label="Lane" value={focus.lane} options={data.lanes.map((item) => ({ value: item.id, label: item.name }))} onChange={(lane) => setFocus({ ...focus, lane })} />
        <FilterSelect label="Campaign" value={focus.campaign} options={data.campaigns.map((item) => ({ value: item.id, label: item.name }))} onChange={(campaign) => setFocus({ ...focus, campaign })} />
        <FilterSelect label="Project" value={focus.project} options={data.projects.map((item) => ({ value: item.id, label: item.name }))} onChange={(project) => setFocus({ ...focus, project })} />
        <FilterSelect label="Status" value={focus.status} options={ACTIVITY_STATUSES} onChange={(status) => setFocus({ ...focus, status })} />
        <FilterSelect label="Priority" value={focus.priority} options={['High', 'Medium', 'Low']} onChange={(priority) => setFocus({ ...focus, priority })} />
        <label className={cx('os-filter', focus.from && 'os-filter-on')}>
          <span className="sr-only">From</span>
          <input type="date" value={focus.from} onChange={(event) => setFocus({ ...focus, from: event.target.value })} className="bg-transparent outline-none" />
        </label>
        <label className={cx('os-filter', focus.to && 'os-filter-on')}>
          <span className="sr-only">To</span>
          <input type="date" value={focus.to} onChange={(event) => setFocus({ ...focus, to: event.target.value })} className="bg-transparent outline-none" />
        </label>
        {focusing ? (
          <button type="button" className="os-link px-1" onClick={() => setFocus(EMPTY_FOCUS)}>
            Clear focus
          </button>
        ) : null}
      </div>

      {data.unscheduled.length ? (
        <div className="border-b border-black/5 px-3 py-2 sm:px-4">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-brand-dark-gray">Unscheduled</p>
          <div className="flex flex-wrap gap-1.5">
            {data.unscheduled.map((item) => {
              const on = !focusing || activityMatches(item, focus, data.lanes.find((lane) => lane.id === item.lane_id)?.group ?? '');
              return (
                <button
                  key={`${item.lane_id}:${item.id}`}
                  type="button"
                  onClick={() => update({ tl: item.id })}
                  className={cx('rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition', on ? 'bg-white text-brand-black ring-black/10' : 'opacity-25')}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {managing && isAdmin ? <LaneManager payload={data} onDone={() => { setManaging(false); void reload(); }} /> : null}

      <div ref={scroller} className="tl-scroll relative min-w-0 w-full overflow-x-auto">
        <div className="relative" style={{ width: LABEL + scale.width, minWidth: LABEL + scale.width }}>
          <div className="sticky top-0 z-20 flex border-b border-black/5 bg-white/95 backdrop-blur-sm">
            <div className="sticky left-0 z-30 shrink-0 border-r border-black/5 bg-white" style={{ width: LABEL, height: headerH }} />
            <div className="relative" style={{ width: scale.width, height: headerH }}>
              {scale.ticks.map((mark) => {
                const isNow = Boolean(today && today >= mark.start && today <= mark.end);
                return (
                  <div
                    key={`${mark.start}:${mark.end}`}
                    className={cx(
                      'absolute top-0 box-border h-full overflow-hidden border-l border-black/[0.06] px-1.5 pt-4 text-brand-dark-gray',
                      isNow && 'bg-brand-burgundy/[0.06]',
                    )}
                    style={{ left: mark.left, width: mark.width }}
                  >
                    <div className="truncate text-[11px] font-semibold leading-none text-brand-black">{mark.label}</div>
                    <div className="mt-1 truncate text-[10px] leading-none">{mark.sublabel}</div>
                    {zoom === 'week' ? (
                      <div className="mt-1 flex px-0.5 text-[9px] leading-none text-brand-dark-gray/80">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                          <span key={`${mark.start}-${index}`} className="flex-1 text-center">
                            {day}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {zoom === 'day' ? (
                      <div className="relative mt-1 h-3 text-[8px] leading-none text-brand-dark-gray/70">
                        <span className="absolute left-1/4 -translate-x-1/2">06</span>
                        <span className="absolute left-1/2 -translate-x-1/2">12</span>
                        <span className="absolute left-3/4 -translate-x-1/2">18</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {nowLeft != null ? (
                <div
                  className="pointer-events-none absolute top-0 z-10 flex h-full -translate-x-1/2 flex-col items-center"
                  style={{ left: nowLeft }}
                  title={now ? now.toString() : undefined}
                >
                  <span className="tl-now rounded-sm bg-brand-burgundy px-1 py-px text-[9px] font-semibold tabular-nums tracking-wide text-white">
                    {clock || 'Now'}
                  </span>
                  <span className="w-0.5 flex-1 bg-brand-burgundy" />
                </div>
              ) : null}
            </div>
          </div>

          {grouped.map(({ lane, items }) => {
            const rows = stackRows(items);
            const depth = items.reduce((max, item) => Math.max(max, (rows.get(`${lane.id}:${item.id}`) ?? 0) + 1), 0);
            const collapsed = !expanded[lane.id] && depth > MAX_COLLAPSED;
            const shown = collapsed ? MAX_COLLAPSED : Math.max(1, depth);
            const height = shown * (BAR_H + ROW_GAP) + 18;
            return (
              <div key={lane.id} className="flex border-b border-black/[0.04]">
                <div className="sticky left-0 z-10 shrink-0 border-r border-black/5 bg-white px-3 py-2" style={{ width: LABEL }}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-brand-black">{lane.name}</p>
                      <p className="truncate text-[11px] text-brand-dark-gray">{lane.owner || 'No owner'}</p>
                    </div>
                    <button type="button" className="btn-ghost h-6 w-6 p-0 text-base" aria-label={`Add to ${lane.name}`} onClick={() => setCreateLane(lane.id)}>
                      +
                    </button>
                  </div>
                  {collapsed ? (
                    <button type="button" className="os-link mt-1" onClick={() => setExpanded((current) => ({ ...current, [lane.id]: true }))}>
                      {depth} overlapping · expand
                    </button>
                  ) : depth > MAX_COLLAPSED ? (
                    <button type="button" className="os-link mt-1" onClick={() => setExpanded((current) => ({ ...current, [lane.id]: false }))}>
                      Collapse
                    </button>
                  ) : null}
                </div>
                <div className="relative" style={{ width: scale.width, height }}>
                  {scale.ticks.map((mark) => (
                    <div key={`grid-${mark.start}`} className="absolute inset-y-0 border-l border-black/[0.045]" style={{ left: mark.left }} />
                  ))}
                  {marks.map((mark, index) => (
                    <div
                      key={`sub-${index}`}
                      className={cx('absolute inset-y-0 border-l', mark.major ? 'border-black/[0.06]' : 'border-black/[0.035]')}
                      style={{ left: mark.left }}
                    />
                  ))}
                  {nowLeft != null ? <div className="absolute inset-y-0 z-[1] w-0.5 bg-brand-burgundy" style={{ left: nowLeft }} /> : null}
                  {items.map((item) => {
                    const box = barBox(item, scale);
                    if (!box) return null;
                    const row = rows.get(`${lane.id}:${item.id}`) ?? 0;
                    if (collapsed && row >= MAX_COLLAPSED) return null;
                    const on = !focusing || activityMatches(item, focus, lane.group);
                    const drag = dragging && dragging.id === item.id && dragging.lane === lane.id ? dragging.dx : 0;
                    const segs = participation(item, focus.people);
                    return (
                      <button
                        key={`${lane.id}:${item.id}`}
                        type="button"
                        onClick={() => update({ tl: item.id })}
                        onPointerDown={(event) => onBarPointer(item, event)}
                        title={`${item.title} · ${item.owner || 'Unassigned'} · ${hoursLabel(item.hours)}`}
                        className={cx('tl-bar absolute flex items-center gap-1 overflow-hidden rounded-md px-1.5 text-left ring-1 transition', barTone(item), on ? 'z-[2]' : 'z-[1] opacity-[0.18]')}
                        style={{ left: box.left + drag, width: box.width, top: 8 + row * (BAR_H + ROW_GAP), height: BAR_H, borderLeft: `3px solid ${item.color}` }}
                      >
                        {segs.map((seg) => {
                          if (!item.start || !seg.start) return null;
                          const inner = barBox({ start: seg.start, end: seg.end || item.end }, scale);
                          if (!inner) return null;
                          return <span key={seg.person} className="absolute inset-y-0 bg-brand-burgundy/25" style={{ left: inner.left - box.left, width: inner.width }} />;
                        })}
                        <span className="relative min-w-0 flex-1 truncate text-[11px] font-medium">{item.title}</span>
                        {item.owner ? <Avatar name={item.owner} /> : null}
                        {item.confirmed ? <span className="relative hidden text-[9px] font-semibold uppercase tracking-wide text-sky-800 sm:inline">API</span> : null}
                      </button>
                    );
                  })}
                  {createLane === lane.id ? (
                    <form
                      className="absolute left-2 top-2 z-10 flex gap-1 rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/10"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void createInLane(lane.id);
                      }}
                    >
                      <input className="os-input h-8 w-44" autoFocus value={createTitle} placeholder="New activity" onChange={(event) => setCreateTitle(event.target.value)} />
                      <button type="submit" className="btn-primary h-8 px-2 text-xs">
                        Add
                      </button>
                      <button type="button" className="btn-ghost h-8 px-2 text-xs" onClick={() => setCreateLane(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirm ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-600/20 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <span>
            Move “{confirm.item.title}” to {shortDate(confirm.start)}
            {confirm.end ? ` – ${shortDate(confirm.end)}` : ''}?
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => void applyMove()}>
              Confirm
            </button>
            <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </span>
        </div>
      ) : null}

      <TimelineDrawer
        activity={openItem}
        open={Boolean(openId)}
        onClose={() => update({ tl: null })}
        onChange={() => refreshAll()}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </section>
  );
}

function LaneManager({ payload, onDone }: { payload: TimelinePayload; onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lanes = payload.lanes;

  async function saveOrder(ids: string[]) {
    try {
      await api('timeline/lanes/order', { method: 'PUT', json: { ids } });
      invalidate('timeline');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="border-b border-black/5 px-3 py-3 sm:px-4">
      <p className="mb-2 text-[13px] font-semibold">Manage lanes</p>
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {lanes.map((lane, index) => (
          <li key={lane.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.07] px-3 py-2">
            <span className="w-36 truncate text-sm font-medium">{lane.name}</span>
            <div className="min-w-[10rem] flex-1">
              <OwnerInput
                value={lane.owner}
                onChange={(owner) => {
                  void api(`timeline/lanes/${lane.id}`, { method: 'PATCH', json: { owner } })
                    .then(() => invalidate('timeline'))
                    .catch((err: Error) => setError(err.message));
                }}
              />
            </div>
            <button type="button" className="btn-ghost px-2 text-xs" disabled={index === 0} onClick={() => void saveOrder(move(lanes.map((item) => item.id), index, -1))}>
              Up
            </button>
            <button type="button" className="btn-ghost px-2 text-xs" disabled={index === lanes.length - 1} onClick={() => void saveOrder(move(lanes.map((item) => item.id), index, 1))}>
              Down
            </button>
            {lane.locked ? (
              <Pill>Default</Pill>
            ) : (
              <button
                type="button"
                className="btn-danger px-2 text-xs"
                onClick={() => {
                  void api(`timeline/lanes/${lane.id}`, { method: 'DELETE' })
                    .then(() => invalidate('timeline'))
                    .catch((err: Error) => setError(err.message));
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void api('timeline/lanes', { method: 'POST', json: { name: name.trim() } })
            .then(() => {
              setName('');
              invalidate('timeline');
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <input className="os-input max-w-xs" value={name} placeholder="New business area" onChange={(event) => setName(event.target.value)} />
        <button type="submit" className="btn-outline px-3 py-1.5 text-[13px]">
          Add lane
        </button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-[13px]" onClick={onDone}>
          Done
        </button>
      </form>
    </div>
  );
}

function move(ids: string[], index: number, dir: number): string[] {
  const next = [...ids];
  const target = index + dir;
  if (target < 0 || target >= next.length) return ids;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
