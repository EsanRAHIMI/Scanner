export function parseMultiValueField(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(/[,\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Split pasted/typed hashtag input into separate tokens (space, comma, newline, semicolon). */
export function parseHashtagInputTokens(raw: string): string[] {
  if (!raw.trim()) return [];

  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const part of raw.split(/[\s,;\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    tokens.push(normalized);
  }

  return tokens;
}

/** Match token to an existing option (case-insensitive) and return canonical spelling. */
export function resolveOptionToken(token: string, optionPool: string[]): string {
  const key = token.trim().toLowerCase();
  if (!key) return token.trim();

  const existing = optionPool.find((option) => option.trim().toLowerCase() === key);
  return existing ?? token.trim();
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
