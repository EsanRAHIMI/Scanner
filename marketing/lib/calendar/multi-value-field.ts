export function parseMultiValueField(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(/[,\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function serializeMultiValueField(values: string[]): string {
  return values.join(', ');
}

export function removeMultiValueItem(raw: unknown, item: string): string {
  const target = item.trim().toLowerCase();
  if (!target) return serializeMultiValueField(parseMultiValueField(raw));
  const next = parseMultiValueField(raw).filter((value) => value.trim().toLowerCase() !== target);
  return serializeMultiValueField(next);
}

export function multiValueFieldContains(raw: unknown, item: string): boolean {
  const target = item.trim().toLowerCase();
  if (!target) return false;
  return parseMultiValueField(raw).some((value) => value.trim().toLowerCase() === target);
}
