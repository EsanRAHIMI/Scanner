type ImportRowLike = {
  row_label?: string;
  fields?: Record<string, unknown>;
};

/** Sentinel stored in show-labels prefs for rows with no Label value. */
export const EMPTY_ROW_LABEL_TOKEN = '(empty)';

/** Suggested chips in the Show labels toolbar (toggle to whitelist). */
export const SUGGESTED_SHOW_LABELS = [EMPTY_ROW_LABEL_TOKEN, '-', 'Crystal', 'custom'] as const;

/**
 * Empty list = no label filter (show every row).
 * Non-empty = only rows whose effective label is in the list are shown.
 */
export const DEFAULT_SHOW_LABELS: string[] = [];

/** @deprecated Use DEFAULT_SHOW_LABELS — kept for older imports. */
export const DEFAULT_HIDDEN_LABELS = DEFAULT_SHOW_LABELS;

function fieldValueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(fieldValueText).filter(Boolean).join(' ');
  return String(value).trim();
}

/** Detect Crystal/custom from any staged cell (not Row). */
export function detectCrystalCustomLabel(
  fields: Record<string, unknown> | undefined,
): 'Crystal' | 'custom' | null {
  if (!fields) return null;
  let hasCrystal = false;
  let hasCustom = false;
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'Row') continue;
    const text = fieldValueText(value).toLowerCase();
    if (!text) continue;
    if (text.includes('crystal')) hasCrystal = true;
    if (text.includes('custom')) hasCustom = true;
  }
  if (hasCrystal) return 'Crystal';
  if (hasCustom) return 'custom';
  return null;
}

export function getImportRowDisplayLabel(row: ImportRowLike): string {
  const saved = (row.row_label ?? '').trim();
  if (saved) return saved;
  return detectCrystalCustomLabel(row.fields) ?? '';
}

export function normalizeShowLabelToken(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return EMPTY_ROW_LABEL_TOKEN;
  const key = trimmed.toLowerCase();
  if (key === EMPTY_ROW_LABEL_TOKEN || key === 'empty' || key === '__empty__') {
    return EMPTY_ROW_LABEL_TOKEN;
  }
  if (key === 'crystal') return 'Crystal';
  if (key === 'custom') return 'custom';
  return trimmed;
}

export function formatShowLabelChip(label: string): string {
  const token = normalizeShowLabelToken(label);
  return token === EMPTY_ROW_LABEL_TOKEN ? 'Empty' : token;
}

function toShowLabelSet(showLabels?: Iterable<string>): Set<string> | null {
  if (showLabels == null) return null;
  const set = new Set<string>();
  for (const label of showLabels) {
    set.add(normalizeShowLabelToken(label).toLowerCase());
  }
  return set.size > 0 ? set : null;
}

/**
 * True when the row should be excluded from the active view / Apply set.
 * Empty showLabels (or null set) means show all rows.
 */
export function isExcludedByShowLabels(
  row: ImportRowLike,
  showLabels?: Iterable<string>,
): boolean {
  const labelSet = toShowLabelSet(showLabels);
  if (!labelSet) return false;

  const display = getImportRowDisplayLabel(row).trim();
  if (!display) return !labelSet.has(EMPTY_ROW_LABEL_TOKEN);
  return !labelSet.has(display.toLowerCase());
}

/** @deprecated Prefer isExcludedByShowLabels — same behavior under Show-labels filter. */
export function isHiddenImportRow(
  row: ImportRowLike,
  showLabels?: Iterable<string>,
): boolean {
  return isExcludedByShowLabels(row, showLabels);
}

export function isLabelAllowedByShowFilter(
  label: string,
  showLabels?: Iterable<string>,
): boolean {
  const labelSet = toShowLabelSet(showLabels);
  if (!labelSet) return true;
  const display = label.trim();
  if (!display) return labelSet.has(EMPTY_ROW_LABEL_TOKEN);
  return labelSet.has(display.toLowerCase());
}
