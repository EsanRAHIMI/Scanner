import * as React from 'react';
import { logFrontendEvent } from '../lib/product-service';

interface UseProductSelectionProps {
}

export function useProductSelection({}: UseProductSelectionProps = {}) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);
  const [familyCollectionName, setFamilyCollectionName] = React.useState<string | null>(null);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getSelectedItems = React.useCallback((items: any[], fallbackIndex: number | null, previewId: string | null) => {
    const byId = new Map(items.map(x => [x.id, x]));
    
    // If we have an explicit previewId (from URL/State), prioritize it
    if (previewId) {
      const found = byId.get(previewId);
      if (found) return [found];
    }

    // Otherwise, use selected IDs
    const picked = Array.from(selectedIds).map(id => byId.get(id)).filter(Boolean);
    if (picked.length > 0) return picked;

    // Fallback to current preview index if nothing selected
    if (fallbackIndex !== null) {
      const current = items[fallbackIndex];
      return current ? [current] : [];
    }

    return [];
  }, [selectedIds]);

  const downloadSelected = React.useCallback(async (items: any[], fallbackIndex: number | null, previewId: string | null) => {
    const selectedItems = getSelectedItems(items, fallbackIndex, previewId);
    if (selectedItems.length === 0) return;

    logFrontendEvent('PRODUCT_DOWNLOAD', `Downloaded ${selectedItems.length} items: ${selectedItems.map((x: any) => x.code || x.title).join(', ')}`);

    for (const item of selectedItems) {
      try {
        const res = await fetch(item.url, { cache: 'no-store' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const filenameBase = (item.code || item.title || 'image').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filenameBase}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch {
        // ignore
      }
    }
  }, [getSelectedItems]);

  const shareSelected = React.useCallback(async (items: any[], fallbackIndex: number | null, previewId: string | null) => {
    const selectedItems = getSelectedItems(items, fallbackIndex, previewId);
    if (selectedItems.length === 0) return;

    const text = selectedItems.map(item => {
      const parts = [`*${item.title}*`];
      if (item.code) parts.push(`Code: ${item.code}`);
      if (item.variant) parts.push(`Variant: ${item.variant}`);
      if (item.price) parts.push(`Price: AED ${item.price}`);
      if (item.rawUrl) parts.push(`Link: ${item.rawUrl}`);
      return parts.join('\n');
    }).join('\n\n---\n\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Shared Products', text });
        logFrontendEvent('PRODUCT_SHARE', `Shared ${selectedItems.length} items via System Share`);
      } else {
        await navigator.clipboard.writeText(text);
        alert('Product info copied to clipboard!');
        logFrontendEvent('PRODUCT_SHARE', `Copied ${selectedItems.length} items to clipboard`);
      }
    } catch {
      // ignore
    }
  }, [getSelectedItems]);

  // Auto-reset showSelectedOnly if selection cleared
  React.useEffect(() => {
    if (selectedIds.size === 0 && showSelectedOnly) {
      setShowSelectedOnly(false);
    }
  }, [selectedIds.size, showSelectedOnly]);

  return {
    selectedIds,
    setSelectedIds,
    toggleSelected,
    showSelectedOnly,
    setShowSelectedOnly,
    familyCollectionName,
    setFamilyCollectionName,
    downloadSelected,
    shareSelected,
    selectedCount: selectedIds.size
  };
}
