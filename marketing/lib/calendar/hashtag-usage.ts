import type { ContentItem } from './types';
import { parseMultiValueField } from './multi-value-field';

const HASHTAG_FIELD = '# Hashtag';

/** Count how many calendar rows use each hashtag (case-insensitive, once per row). */
export function buildHashtagUsageCounts(items: ContentItem[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const tags = parseMultiValueField(item.fields?.[HASHTAG_FIELD]);
    const seenInRow = new Set<string>();

    for (const tag of tags) {
      const key = tag.trim().toLowerCase();
      if (!key || seenInRow.has(key)) continue;
      seenInRow.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

export function getHashtagUsageCount(
  hashtag: string,
  usageCounts: ReadonlyMap<string, number>,
): number {
  const key = hashtag.trim().toLowerCase();
  if (!key) return 0;
  return usageCounts.get(key) ?? 0;
}
