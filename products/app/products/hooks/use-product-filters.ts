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

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Derived: Displayed Columns
  const displayedColumns = React.useMemo(() => {
    const isAdmin = user?.is_admin === true || user?.role === 'admin';
    const ordered = [
      'Image', 'DAM', 'Video', 'Price', 'URL', 'Colecction Name', 'Colecction Code', 
      'Variant Number', 'Category', 'Space', 'Color', 'Material', 'DIMENSION (mm)', 
      'Note', 'CODE NUMBER', 'L000', 'Num'
    ] as const;

    if (columns.length === 0 && loading) {
      return ['Image', 'DAM', 'Video', 'Price', 'Colecction Name', 'Variant Number', 'Category'];
    }

    const orderedSet = new Set<string>(ordered as readonly string[]);
    const out: string[] = [];

    for (const key of ordered) {
      if (key === 'URL') continue;
      if (columns.includes(key) || key === 'DAM' || key === 'Video') {
        out.push(key);
        if (key === 'DAM' && isAdmin && columns.includes('URL')) {
          out.push('URL');
        }
      }
    }

    const extras = columns
      .filter((c) => !orderedSet.has(c) && c !== 'URL' && c !== 'Main' && c !== 'Content Calendar')
      .sort((a, b) => a.localeCompare(b));
    out.push(...extras);

    if (columns.includes('URL') && !isAdmin) {
      if (!out.includes('Main')) out.push('Main');
      out.push('URL');
    } else {
      if (!out.includes('Main')) out.push('Main');
    }

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

  // Filter Logic
  const filteredRecords = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let base = !q ? records : records.filter((r) => {
      const text = getSearchText(r, displayedColumns);
      if (text.includes(q)) return true;
      const words = q.split(/\s+/);
      return words.every(word => text.includes(word));
    });

    if (selectedCategories.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[categoryFieldName];
        if (typeof v === 'string') return v.split(',').some(p => selectedCategories.has(p.trim()));
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && x.split(',').some(p => selectedCategories.has(p.trim())));
        return false;
      });
    }
    if (selectedColors.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[colorFieldName];
        if (typeof v === 'string') return v.split(',').some(p => selectedColors.has(p.trim()));
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && x.split(',').some(p => selectedColors.has(p.trim())));
        return false;
      });
    }
    if (selectedSpaces.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[spaceFieldName];
        if (typeof v === 'string') return v.split(',').some(p => selectedSpaces.has(p.trim()));
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && x.split(',').some(p => selectedSpaces.has(p.trim())));
        return false;
      });
    }
    if (selectedMaterials.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[materialFieldName];
        if (typeof v === 'string') return v.split(',').some(p => selectedMaterials.has(p.trim()));
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && x.split(',').some(p => selectedMaterials.has(p.trim())));
        return false;
      });
    }

    if (!showSelectedOnly) {
      if (familyCollectionName) {
        const key = familyCollectionName.toLowerCase().trim();
        base = base.filter(r => {
          const name = (
            formatScalar(r.fields?.['Colecction Name']) || 
            formatScalar(r.fields?.Name) || 
            formatScalar(r.fields?.['Collection Name']) || 
            ''
          ).toLowerCase().trim();
          return name === key;
        });
      }
      return base;
    }
    return base.filter((r) => selectedIds.has(r.id));
  }, [
    displayedColumns, getSearchText, records, debouncedSearch, selectedIds, 
    showSelectedOnly, selectedCategories, selectedColors, selectedSpaces, 
    selectedMaterials, categoryFieldName, colorFieldName, spaceFieldName, 
    materialFieldName, familyCollectionName
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
