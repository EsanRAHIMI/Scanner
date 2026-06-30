type ImportRowLike = {
  row_label?: string;
  fields?: Record<string, unknown>;
};

const HIDDEN_LABELS = new Set(['-', 'crystal', 'custom']);

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

export function isHiddenImportRow(row: ImportRowLike): boolean {
  const saved = (row.row_label ?? '').trim();
  const label = saved.toLowerCase();
  if (HIDDEN_LABELS.has(label)) return true;
  if (saved) return false;
  return detectCrystalCustomLabel(row.fields) !== null;
}

export function getImportRowDisplayLabel(row: ImportRowLike): string {
  const saved = (row.row_label ?? '').trim();
  if (saved) return saved;
  return detectCrystalCustomLabel(row.fields) ?? '';
}
