import * as React from 'react';
import type { ProductsRecord } from '@/types/trainer';
import {
  isVideoUrl,
  extractUrls,
  findUrlFieldValue,
  resolveUrlFieldKey,
  buildImageFieldOrderPatch,
  mergeProductMediaUrls,
} from '../lib/product-utils';

interface UseProductDragDropProps {
  handleSaveField: (recordId: string, fieldName: string, newValue: any, records: ProductsRecord[]) => Promise<void>;
  handleSaveFields?: (recordId: string, fieldsPatch: Record<string, unknown>, records: ProductsRecord[]) => Promise<void>;
  records: ProductsRecord[];
  columns: string[];
}

export function useProductDragDrop({ handleSaveField, handleSaveFields, records, columns }: UseProductDragDropProps) {
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

    const targetUrls = extractUrls(targetRecord.fields[urlFieldName]);
    const sourceUrls = extractUrls(sourceRecord.fields[urlFieldName]).filter(u => u !== url);

    const hadTargetUrl = targetUrls.includes(finalUrlToMove);
    if (!hadTargetUrl) {
      const targetNext = [...targetUrls, finalUrlToMove];
      await handleSaveField(toId, urlFieldName, targetNext.join('\n'), records);
    }

    try {
      await handleSaveField(fromId, urlFieldName, sourceUrls.join('\n'), records);
    } catch (err) {
      if (!hadTargetUrl) {
        const rollbackTargetUrls = targetUrls.join('\n');
        await handleSaveField(toId, urlFieldName, rollbackTargetUrls, records);
      }
      throw err;
    }
  }, [columns, records, handleSaveField]);

  const handleReorderUrls = React.useCallback(
    async (recordId: string, fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const record = records.find((r) => r.id === recordId);
      if (!record) return;

      const urlFieldKey = resolveUrlFieldKey(record.fields, columns);
      const imageField = columns.find((c) => c.trim().toLowerCase() === 'image');
      const damField = columns.find((c) => c.trim().toLowerCase() === 'dam');
      const urls = extractUrls(
        mergeProductMediaUrls(
          record.fields[urlFieldKey] ?? findUrlFieldValue(record.fields),
          imageField ? record.fields[imageField] : undefined,
          damField ? record.fields[damField] : undefined,
        ),
      );
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= urls.length ||
        toIndex >= urls.length
      ) {
        return;
      }

      const next = [...urls];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      const patch: Record<string, unknown> = {
        [urlFieldKey]: next.join('\n'),
        ...buildImageFieldOrderPatch(record.fields, columns, next),
      };

      if (handleSaveFields) {
        await handleSaveFields(recordId, patch, records);
      } else {
        await handleSaveField(recordId, urlFieldKey, next.join('\n'), records);
      }
    },
    [columns, records, handleSaveField, handleSaveFields],
  );

  return {
    draggedUrlInfo,
    setDraggedUrlInfo,
    activeDropTargetRef,
    handleMoveUrl,
    handleReorderUrls,
  };
}
