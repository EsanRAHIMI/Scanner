export type SourceFlag = {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: 'error' | 'unknown';
};

type Connector = { name: string; state?: string; detail?: string };
type Odoo = { state?: string; detail?: string };

function shortDetail(detail?: string, fallback = 'Needs a fix'): string {
  const raw = (detail || '').trim();
  if (!raw) return fallback;
  const cut = raw.includes('{') ? raw.slice(0, raw.indexOf('{')).replace(/:\s*$/, '').trim() : raw;
  return cut.length > 90 ? `${cut.slice(0, 88)}…` : cut || fallback;
}

/** Surface real connector / CRM gaps. Never invent a number. */
export function sourceFlags(input: {
  connectors?: Connector[];
  missing?: string[];
  odoo?: Odoo | null;
  qualified?: number | null;
}): SourceFlag[] {
  const out: SourceFlag[] = [];
  const seen = new Set<string>();

  const odoo = input.odoo;
  if (odoo && (odoo.state === 'error' || odoo.state === 'unconfigured')) {
    out.push({
      id: 'odoo',
      label: 'Odoo CRM',
      detail: odoo.state === 'unconfigured' ? 'Disconnected' : shortDetail(odoo.detail, 'Disconnected'),
      href: '/connections',
      tone: 'error',
    });
    seen.add('odoo');
  }

  for (const connector of input.connectors ?? []) {
    const name = (connector.name || '').trim();
    if (!name || connector.state === 'ok') continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const waiting = connector.state === 'unconfigured';
    out.push({
      id: key,
      label: name,
      detail: shortDetail(connector.detail, waiting ? 'Not connected' : 'Needs a fix'),
      href: '/connections',
      tone: waiting ? 'unknown' : 'error',
    });
  }

  for (const channel of input.missing ?? []) {
    const key = channel.toLowerCase();
    if (!channel || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `missing-${key}`,
      label: channel,
      detail: 'Unknown — no snapshot in this range',
      href: '/paid',
      tone: 'unknown',
    });
  }

  return out;
}
