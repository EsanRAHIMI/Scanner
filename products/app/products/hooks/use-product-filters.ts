import * as React from 'react';
import type { ProductsRecord } from '@/types/trainer';
import { extractUrls, formatScalar, getDriveDirectLink, isVideoUrl, formatPrice } from '../lib/product-utils';

interface UseProductFiltersProps {
  records: ProductsRecord[];
  columns: string[];
  loading: boolean;
  user: { role: string; is_admin: boolean } | null;
  selectedIds: Set<string>;
  showSelectedOnly: boolean;
  familyCollectionName: string | null;
  familyMode: 'collection' | 'main';
}

export function useProductFilters({
  records,
  columns,
  loading,
  user,
  selectedIds,
  showSelectedOnly,
  familyCollectionName,
  familyMode,
}: UseProductFiltersProps) {
  // State
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState('Num');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = React.useState<'list' | 'gallery'>('gallery');
  const [selectedCategories, setSelectedCategories] = React.useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = React.useState<Set<string>>(new Set());
  const [selectedSpaces, setSelectedSpaces] = React.useState<Set<string>>(new Set());
  const [selectedMaterials, setSelectedMaterials] = React.useState<Set<string>>(new Set());
  const [activeFilterDropdown, setActiveFilterDropdown] = React.useState<string | null>(null);

  // Field Names
  const categoryFieldName = columns.find(c => c.trim().toLowerCase() === 'category') || 'Category';
  const colorFieldName = columns.find(c => c.trim().toLowerCase() === 'color') || 'Color';
  const spaceFieldName = columns.find(c => c.trim().toLowerCase() === 'space') || 'Space';
  const materialFieldName = columns.find(c => c.trim().toLowerCase() === 'material') || 'Material';

  // Debounced search drives URL sync and filtering (highlights still use live `search`).
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 280);
    return () => clearTimeout(t);
  }, [search]);

  // Derived: Displayed Columns
  const displayedColumns = React.useMemo(() => {
    const pickColumn = (candidates: string[]) => {
      const normalized = new Map(columns.map(column => [column.trim().toLowerCase(), column]));
      for (const candidate of candidates) {
        const found = normalized.get(candidate.trim().toLowerCase());
        if (found) return found;
      }
      return null;
    };

    const ordered = [
      pickColumn(['Image']) ?? 'Image',
      pickColumn(['Code Number', 'CODE NUMBER']),
      pickColumn(['Name', 'Colecction Name', 'Collection Name']),
      pickColumn(['Price']),
      pickColumn(['Colecction Code', 'Collection Code', 'Code']),
      pickColumn(['Variant Number', 'Variant']),
      pickColumn(['Dimension (mm)', 'DIMENSION (mm)', 'DIMENSION', 'Dimension']),
      pickColumn(['Note']),
      pickColumn(['Category']),
      pickColumn(['Material']),
      pickColumn(['Color']),
      pickColumn(['Space']),
      pickColumn(['Factory Code']),
      pickColumn(['Details']),
      pickColumn(['h', 'H']),
      pickColumn(['l', 'L']),
      pickColumn(['w', 'W']),
      'Video',
      'URL',
      'Main',
      pickColumn(['Num']),
    ].filter(Boolean) as string[];

    if (columns.length === 0 && loading) {
      return ['Image', 'CODE NUMBER', 'Colecction Name', 'Price', 'Video', 'URL', 'Main', 'Num'];
    }

    const out: string[] = [];

    for (const key of ordered) {
      if (!out.includes(key) && (columns.includes(key) || key === 'Image' || key === 'Video' || key === 'URL' || key === 'Main')) {
        out.push(key);
      }
    }

    const orderedSet = new Set(out);
    const extras = columns
      .filter((c) => !orderedSet.has(c) && c !== 'DAM' && c !== 'URL' && c !== 'Main' && c !== 'Content Calendar' && c !== 'Video' && c !== 'L000')
      .sort((a, b) => a.localeCompare(b));
    out.push(...extras);

    return out;
  }, [columns, loading, user]);

  // Search Logic
  const getSearchText = React.useCallback((r: ProductsRecord, usedColumns: string[]) => {
    const parts: string[] = [];
    for (const c of usedColumns) {
      const v = r.fields?.[c];
      if (v === null || v === undefined) continue;
      const colLower = c.trim().toLowerCase();
      if (colLower === 'image' || colLower === 'dam') {
        const urls = extractUrls(v);
        if (urls.length > 0) parts.push(urls.join(' | '));
        continue;
      }
      if (Array.isArray(v)) {
        const arr = v as unknown[];
        const allStrings = arr.every((x) => typeof x === 'string');
        if (allStrings) parts.push((arr as string[]).join(' | '));
        else parts.push(String(arr.length));
        continue;
      }
      const s = formatScalar(v);
      if (s) parts.push(s);
    }
    return parts.join(' \n ').toLowerCase();
  }, []);

  const recordSearchTextById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of records) {
      m.set(r.id, getSearchText(r, displayedColumns));
    }
    return m;
  }, [records, displayedColumns, getSearchText]);

  const matchesFacetFilters = React.useCallback(
    (r: ProductsRecord): boolean => {
      if (selectedCategories.size > 0) {
        const v = r.fields?.[categoryFieldName];
        const ok =
          (typeof v === 'string' && v.split(',').some((p) => selectedCategories.has(p.trim()))) ||
          (Array.isArray(v) &&
            v.some(
              (x) =>
                typeof x === 'string' &&
                x.split(',').some((p) => selectedCategories.has(p.trim())),
            ));
        if (!ok) return false;
      }
      if (selectedColors.size > 0) {
        const v = r.fields?.[colorFieldName];
        const ok =
          (typeof v === 'string' && v.split(',').some((p) => selectedColors.has(p.trim()))) ||
          (Array.isArray(v) &&
            v.some(
              (x) =>
                typeof x === 'string' &&
                x.split(',').some((p) => selectedColors.has(p.trim())),
            ));
        if (!ok) return false;
      }
      if (selectedSpaces.size > 0) {
        const v = r.fields?.[spaceFieldName];
        const ok =
          (typeof v === 'string' && v.split(',').some((p) => selectedSpaces.has(p.trim()))) ||
          (Array.isArray(v) &&
            v.some(
              (x) =>
                typeof x === 'string' &&
                x.split(',').some((p) => selectedSpaces.has(p.trim())),
            ));
        if (!ok) return false;
      }
      if (selectedMaterials.size > 0) {
        const v = r.fields?.[materialFieldName];
        const ok =
          (typeof v === 'string' && v.split(',').some((p) => selectedMaterials.has(p.trim()))) ||
          (Array.isArray(v) &&
            v.some(
              (x) =>
                typeof x === 'string' &&
                x.split(',').some((p) => selectedMaterials.has(p.trim())),
            ));
        if (!ok) return false;
      }
      return true;
    },
    [
      categoryFieldName,
      colorFieldName,
      materialFieldName,
      selectedCategories,
      selectedColors,
      selectedMaterials,
      selectedSpaces,
      spaceFieldName,
    ],
  );

  // Filter Logic
  const filteredRecords = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let base =
      !q ?
        records
      : records.filter((r) => {
          const text = recordSearchTextById.get(r.id) ?? '';
          if (text.includes(q)) return true;
          const words = q.split(/\s+/);
          return words.every((word) => text.includes(word));
        });

    if (
      selectedCategories.size > 0 ||
      selectedColors.size > 0 ||
      selectedSpaces.size > 0 ||
      selectedMaterials.size > 0
    ) {
      base = base.filter(matchesFacetFilters);
    }

    if (!showSelectedOnly) {
      if (familyCollectionName) {
        const key = familyCollectionName.toLowerCase().trim();
        base = base.filter((r) => {
          const name = (
            formatScalar(r.fields?.['Colecction Name']) ||
            formatScalar(r.fields?.Name) ||
            formatScalar(r.fields?.['Collection Name']) ||
            ''
          )
            .toLowerCase()
            .trim();
          return name === key;
        });
      }
      return base;
    }
    return base.filter((r) => selectedIds.has(r.id));
  }, [
    debouncedSearch,
    familyCollectionName,
    matchesFacetFilters,
    recordSearchTextById,
    records,
    selectedIds,
    showSelectedOnly,
    selectedCategories.size,
    selectedColors.size,
    selectedMaterials.size,
    selectedSpaces.size,
  ]);

  // Sort Logic
  const getSortValue = React.useCallback((r: ProductsRecord, key: string) => {
    const k = key.trim().toLowerCase();
    if (k === 'image') {
      const urls = extractUrls(r.fields?.[key]);
      return urls[0] ?? '';
    }
    const v = r.fields?.[key];
    if (v === null || v === undefined) return '';
    if (k === 'price') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const cleaned = v.trim().replace(/,/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }
    if (k === 'num' || k === 'variant number') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') return v.toLowerCase();
    if (Array.isArray(v)) {
      const arr = v as unknown[];
      const allStrings = arr.every((x) => typeof x === 'string');
      if (allStrings) return (arr as string[]).join(' | ').toLowerCase();
      return arr.length;
    }
    return '';
  }, []);

  const sortedRecords = React.useMemo(() => {
    if (filteredRecords.length <= 1) return filteredRecords;

    const base = [...filteredRecords];
    base.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      if (cmp === 0) {
        const aMain = a.fields?.Main === true;
        const bMain = b.fields?.Main === true;
        if (aMain && !bMain) return -1;
        if (!aMain && bMain) return 1;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return base;
  }, [filteredRecords, sortKey, sortDir, getSortValue]);

  // Variant Counts
  const variantCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    sortedRecords.forEach(r => {
      const raw =
        formatScalar(r.fields?.['Colecction Name']) ||
        formatScalar(r.fields?.Name) ||
        formatScalar(r.fields?.['Collection Name']) ||
        '';
      const key = raw.trim();
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [sortedRecords]);

  // Visible Records (Grouped by Collection)
  const visibleRecords = React.useMemo(() => {
    if (familyMode !== 'main' || familyCollectionName) return sortedRecords;

    const groupMap = new Map<string, ProductsRecord>();
    const out: ProductsRecord[] = [];

    for (const r of sortedRecords) {
      const raw =
        formatScalar(r.fields?.['Colecction Name']) ||
        formatScalar(r.fields?.Name) ||
        formatScalar(r.fields?.['Collection Name']) ||
        '';
      const key = raw.trim();

      if (!key) {
        out.push(r);
        continue;
      }

      const isMain = r.fields?.Main === true;
      const existing = groupMap.get(key);

      if (!existing || (isMain && existing.fields?.Main !== true)) {
        groupMap.set(key, r);
      }
    }

    const seenGroups = new Set<string>();
    for (const r of sortedRecords) {
      const raw =
        formatScalar(r.fields?.['Colecction Name']) ||
        formatScalar(r.fields?.Name) ||
        formatScalar(r.fields?.['Collection Name']) ||
        '';
      const key = raw.trim();
      if (!key) continue;
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);
      const chosen = groupMap.get(key);
      if (chosen) out.push(chosen);
    }

    return out;
  }, [familyMode, sortedRecords, familyCollectionName]);

  // Helper for mapping records to gallery items
  const mapToGalleryItem = React.useCallback((r: ProductsRecord) => {
    const fields = r.fields ?? {};
    const fieldKeys = Object.keys(fields);
    
    const urlKey = fieldKeys.find(k => {
      const l = k.trim().toLowerCase();
      return l === 'url' || l.endsWith(' url') || l.endsWith('_url') || l.endsWith('-url');
    });
    
    const damUrls = extractUrls(urlKey ? fields[urlKey] : undefined);
    const imageUrls = extractUrls(fields.Image);
    
    const allMedia = [...damUrls, ...imageUrls].map(u => {
      const directUrl = getDriveDirectLink(u);
      return {
        originalUrl: u,
        url: directUrl,
        driveId: directUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || null,
        isVideo: isVideoUrl(u)
      };
    });

    const collectionName = formatScalar(fields['Colecction Name']) || formatScalar(fields['Name']) || '';
    
    return {
      id: r.id,
      fields,
      allMedia,
      originalUrl: allMedia[0]?.originalUrl || '',
      url: allMedia[0]?.url || '',
      driveId: allMedia[0]?.driveId || null,
      collectionName,
      collectionNameNormalized: collectionName.trim(),
      title: collectionName || 'Product',
      code: formatScalar(fields['Colecction Code']) || formatScalar(fields['Code']),
      variant: formatScalar(fields['Variant Number']) || formatScalar(fields['Num']),
      price: formatPrice(fields.Price) ?? null,
      dimension: formatScalar(fields['DIMENSION (mm)']) || formatScalar(fields['Dimension (mm)']) || formatScalar(fields['DIMENSION']) || '',
    };
  }, []);

  const allGalleryItems = React.useMemo(() => {
    return sortedRecords.map(mapToGalleryItem).filter(x => Boolean(x.url));
  }, [sortedRecords, mapToGalleryItem]);

  const baseGalleryItems = React.useMemo(() => {
    return visibleRecords.map(mapToGalleryItem).filter(x => Boolean(x.url));
  }, [visibleRecords, mapToGalleryItem]);

  // Final Gallery Items enriched with sibling counts
  const galleryItems = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allGalleryItems) {
      const key = item.collectionNameNormalized;
      counts[key] = (counts[key] || 0) + 1;
    }

    const mapped = allGalleryItems.map((item) => ({
      ...item,
      siblingCount: counts[item.collectionNameNormalized] || 1
    }));

    if (!familyCollectionName) {
      const baseIds = new Set(baseGalleryItems.map((x) => x.id));
      return mapped.filter((x) => baseIds.has(x.id));
    }

    const key = familyCollectionName.trim();
    return mapped.filter((x) => x.collectionNameNormalized === key);
  }, [allGalleryItems, baseGalleryItems, familyCollectionName]);

  return {
    search, setSearch,
    debouncedSearch,
    sortKey, setSortKey,
    sortDir, setSortDir,
    viewMode, setViewMode,
    selectedCategories, setSelectedCategories,
    selectedColors, setSelectedColors,
    selectedSpaces, setSelectedSpaces,
    selectedMaterials, setSelectedMaterials,
    activeFilterDropdown, setActiveFilterDropdown,
    displayedColumns,
    filteredRecords,
    sortedRecords,
    variantCounts,
    visibleRecords,
    baseGalleryItems,
    allGalleryItems,
    galleryItems,
    categoryFieldName,
    colorFieldName,
    spaceFieldName,
    materialFieldName
  };
}
