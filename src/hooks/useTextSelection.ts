import { useCallback, useEffect, useRef } from 'react';

export interface SelectionInfo {
  text: string;
  rects: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
}

export function useTextSelection(
  containerRef: React.RefObject<HTMLElement>,
  onSelect: (selection: SelectionInfo) => void,
  enabled: boolean = true
) {
  const isSelecting = useRef(false);

  const getSelectionInfo = useCallback((): SelectionInfo | null => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return null;
    }

    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const range = selection.getRangeAt(0);
    const rectList = range.getClientRects();
    
    const rects: Array<{ left: number; top: number; width: number; height: number }> = [];
    
    for (let i = 0; i < rectList.length; i++) {
      const rect = rectList[i];
      rects.push({
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      });
    }

    return {
      text: selection.toString().trim(),
      rects,
    };
  }, [containerRef]);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = () => {
      isSelecting.current = true;
    };

    const handleMouseUp = () => {
      if (!isSelecting.current) return;
      isSelecting.current = false;

      // Small delay to let selection finalize
      setTimeout(() => {
        const info = getSelectionInfo();
        if (info && info.text.length > 0) {
          onSelect(info);
        }
      }, 10);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousedown', handleMouseDown);
      }
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, onSelect, enabled, getSelectionInfo]);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);

  return { clearSelection };
}
