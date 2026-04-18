import * as React from 'react';
import type { ProductsRecord } from '@/types/trainer';
import { isVideoUrl, extractUrls } from '../lib/product-utils';

interface UseProductDragDropProps {
  handleSaveField: (recordId: string, fieldName: string, newValue: any, records: ProductsRecord[]) => Promise<void>;
  records: ProductsRecord[];
  columns: string[];
}

export function useProductDragDrop({ handleSaveField, records, columns }: UseProductDragDropProps) {
  const [draggedUrlInfo, setDraggedUrlInfo] = React.useState<{ url: string; sourceId: string; sourceColumn: string } | null>(null);
  const activeDropTargetRef = React.useRef<HTMLElement | null>(null);

  const handleMoveUrl = React.useCallback(async (url: string, fromId: string, toId: string, targetCol?: string) => {
    if (fromId === toId) return;

    const urlFieldName = columns.find(c => c.trim().toLowerCase() === 'url') || 'URL';
    let finalUrlToMove = url;
    
    if (targetCol?.trim().toLowerCase() === 'video' && !isVideoUrl(finalUrlToMove)) {
      finalUrlToMove = finalUrlToMove.trim() + '#video';
    } else if (targetCol?.trim().toLowerCase() !== 'video' && isVideoUrl(finalUrlToMove)) {
      finalUrlToMove = finalUrlToMove.replace('#video', '').trim();
    }

    const sourceRecord = records.find(r => r.id === fromId);
    const targetRecord = records.find(r => r.id === toId);
    if (!sourceRecord || !targetRecord) return;

    // Remove from source
    const sourceUrls = extractUrls(sourceRecord.fields[urlFieldName]).filter(u => u !== url);
    await handleSaveField(fromId, urlFieldName, sourceUrls.join('\n'), records);

    // Add to target
    const targetUrls = extractUrls(targetRecord.fields[urlFieldName]);
    if (!targetUrls.includes(finalUrlToMove)) {
      targetUrls.push(finalUrlToMove);
      await handleSaveField(toId, urlFieldName, targetUrls.join('\n'), records);
    }
  }, [columns, records, handleSaveField]);

  return {
    draggedUrlInfo,
    setDraggedUrlInfo,
    activeDropTargetRef,
    handleMoveUrl
  };
}
