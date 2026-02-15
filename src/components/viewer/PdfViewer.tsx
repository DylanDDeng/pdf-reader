import { useEffect, useRef, useCallback, useState } from 'react';
import {
  loadPdfDocument,
  renderPage,
  renderTextLayer,
  extractOutline,
  type OutlineItem,
  type PdfTextLayerTask,
} from '../../utils/pdf';
import { HighlightLayer } from './HighlightLayer';
import { SelectionToolbar, type AnnotationAction } from './SelectionToolbar';
import type { Annotation, HighlightColor } from '../../types/annotation';

interface PdfViewerProps {
  file: File | string;
  currentPage: number;
  scale: number;
  annotations: Annotation[];
  onDocumentLoad: (totalPages: number, outline: OutlineItem[]) => void;
  onAddHighlight: (
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => void;
  onHighlightClick?: (annotation: Annotation) => void;
  interactiveHighlights?: boolean;
}

export function PdfViewer({
  file,
  currentPage,
  scale,
  annotations,
  onDocumentLoad,
  onAddHighlight,
  onHighlightClick,
  interactiveHighlights = false,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  
  // 选中文本相关状态
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectedRects, setSelectedRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  
  // 用于防止选择事件重复触发
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textLayerTaskRef = useRef<PdfTextLayerTask | null>(null);
  const renderedTextLayerRef = useRef<HTMLDivElement | null>(null);
  const renderSeqRef = useRef(0);
  const isPointerSelectingRef = useRef(false);
  const lastSelectionKeyRef = useRef('');

  const renderCurrentPage = useCallback(async () => {
    if (!documentRef.current || !canvasRef.current || !textLayerRef.current) {
      return;
    }

    const renderSeq = ++renderSeqRef.current;

    try {
      const page = await documentRef.current.getPage(currentPage);
      
      const viewport = page.getViewport({ scale });
      setPageSize({ width: viewport.width, height: viewport.height });
      
      // Render canvas
      await renderPage(page, canvasRef.current, scale);
      if (renderSeq !== renderSeqRef.current) {
        return;
      }
      
      // Render text layer
      textLayerTaskRef.current = await renderTextLayer(
        page,
        textLayerRef.current,
        scale,
        textLayerTaskRef.current
      );
      renderedTextLayerRef.current = textLayerTaskRef.current.element;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('TextLayer task cancelled')) {
        console.error('Error rendering page:', err);
      }
    }
  }, [currentPage, scale]);

  // Load document
  useEffect(() => {
    let isMounted = true;
    const loadSeq = ++renderSeqRef.current;

    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
      textLayerTaskRef.current?.destroy();
      textLayerTaskRef.current = null;
      renderedTextLayerRef.current = null;
      // 清除之前的选择状态
      setToolbarPosition(null);
      setSelectedText('');
      setSelectedRects([]);
      
      try {
        let source: ArrayBuffer;

        if (typeof file === 'string') {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const contents = await readFile(file);
          source = new Uint8Array(contents).buffer as ArrayBuffer;
        } else {
          source = await file.arrayBuffer();
        }

        const doc = await loadPdfDocument(source);

        if (isMounted) {
          documentRef.current = doc;
          
          // Extract outline from PDF
          const outline = await extractOutline(doc);
          onDocumentLoad(doc.numPages, outline);

          if (canvasRef.current && textLayerRef.current) {
            const initialPage = Math.max(1, Math.min(currentPage, doc.numPages));
            const page = await doc.getPage(initialPage);
            const viewport = page.getViewport({ scale });
            setPageSize({ width: viewport.width, height: viewport.height });
            
            await renderPage(page, canvasRef.current, scale);
            if (loadSeq === renderSeqRef.current) {
              textLayerTaskRef.current = await renderTextLayer(
                page,
                textLayerRef.current,
                scale,
                textLayerTaskRef.current
              );
              renderedTextLayerRef.current = textLayerTaskRef.current.element;
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isCancelled = message.includes('TextLayer task cancelled');
        if (!isCancelled) {
          console.error('Error loading PDF:', err);
        }
        if (isMounted) {
          if (!isCancelled) {
            setError(`Failed to load PDF: ${message}`);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
      renderSeqRef.current += 1;
      textLayerTaskRef.current?.destroy();
      textLayerTaskRef.current = null;
      renderedTextLayerRef.current = null;
      if (documentRef.current) {
        documentRef.current.destroy();
        documentRef.current = null;
      }
    };
  }, [file, onDocumentLoad]);

  // Render page when current page or scale changes
  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // 检查选择是否在文本层内
  const isSelectionInTextLayer = useCallback((selection: Selection): boolean => {
    const textLayer = renderedTextLayerRef.current;
    if (!textLayer || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);

    const getOwnerLayer = (node: Node): HTMLDivElement | null => {
      const element = node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;
      if (!element) return null;
      return element.closest('.textLayer') as HTMLDivElement | null;
    };

    const startLayer = getOwnerLayer(range.startContainer);
    const endLayer = getOwnerLayer(range.endContainer);

    return startLayer === textLayer && endLayer === textLayer;
  }, []);

  // 获取选中文本的信息
  const getSelectionInfo = useCallback((selection: Selection): { text: string; rects: Array<{ left: number; top: number; width: number; height: number }>; mousePosition: { x: number; y: number } } | null => {
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return null;
    }

    const textLayer = renderedTextLayerRef.current;
    if (!textLayer) return null;

    const containerRect = textLayer.getBoundingClientRect();
    const range = selection.getRangeAt(0);
    const rectList = range.getClientRects();
    
    if (rectList.length === 0) return null;

    const rects: Array<{ left: number; top: number; width: number; height: number }> = [];
    const acceptedRects: DOMRect[] = [];
    const pageArea = containerRect.width * containerRect.height;
    
    for (let i = 0; i < rectList.length; i++) {
      const rect = rectList[i];
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      // Filter out accidental full-page rects that can appear during unstable range updates.
      if (rect.width >= containerRect.width * 0.98 && rect.height >= containerRect.height * 0.98) {
        continue;
      }

      const area = rect.width * rect.height;
      if (area > pageArea * 0.9) {
        continue;
      }

      rects.push({
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      });
      acceptedRects.push(rect);
    }

    if (rects.length === 0) return null;

    // 获取鼠标位置（使用选区的最后一个矩形中心）
    const lastRect = acceptedRects[acceptedRects.length - 1];
    const mousePosition = {
      x: lastRect.left + lastRect.width / 2,
      y: lastRect.top,
    };

    return {
      text: selection.toString().trim(),
      rects,
      mousePosition,
    };
  }, []);

  const resetSelectionState = useCallback((clearBrowserSelection: boolean = false) => {
    if (clearBrowserSelection) {
      window.getSelection()?.removeAllRanges();
    }

    lastSelectionKeyRef.current = '';
    setToolbarPosition(null);
    setSelectedText('');
    setSelectedRects([]);
  }, []);

  const updateSelectionFromWindow = useCallback((clearOnInvalid: boolean = true) => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      if (clearOnInvalid) {
        resetSelectionState();
      }
      return;
    }

    if (!isSelectionInTextLayer(selection)) {
      if (clearOnInvalid) {
        resetSelectionState();
      }
      return;
    }

    const info = getSelectionInfo(selection);
    if (!info || info.text.length === 0) {
      if (clearOnInvalid) {
        resetSelectionState();
      }
      return;
    }

    const signature = `${info.text}:${info.rects.length}:${Math.round(info.rects[0]?.left ?? 0)}:${Math.round(info.rects[0]?.top ?? 0)}`;
    if (signature === lastSelectionKeyRef.current) {
      return;
    }

    lastSelectionKeyRef.current = signature;
    setSelectedText(info.text);
    setSelectedRects(info.rects);
    setToolbarPosition(info.mousePosition);
  }, [getSelectionInfo, isSelectionInTextLayer, resetSelectionState]);

  // Selection is finalized on pointer-up to avoid toolbar flicker while dragging.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const textLayer = renderedTextLayerRef.current;
      if (!textLayer) return;
      if (!(event.target instanceof Node)) return;
      if (!textLayer.contains(event.target)) return;

      isPointerSelectingRef.current = true;
      setToolbarPosition(null);
    };

    const handlePointerUp = () => {
      if (!isPointerSelectingRef.current) {
        return;
      }

      isPointerSelectingRef.current = false;
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      selectionTimeoutRef.current = setTimeout(() => {
        updateSelectionFromWindow(true);
      }, 20);
    };

    const handleSelectionChange = () => {
      if (isPointerSelectingRef.current) {
        return;
      }
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      selectionTimeoutRef.current = setTimeout(() => {
        updateSelectionFromWindow(false);
      }, 20);
    };

    const handleKeySelection = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key.startsWith('Arrow')) {
        handleSelectionChange();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keyup', handleKeySelection, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keyup', handleKeySelection, true);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [updateSelectionFromWindow]);

  // 处理高亮操作
  const handleToolbarAction = (action: AnnotationAction) => {
    if (action === 'highlight' && selectedText && selectedRects.length > 0) {
      // 调整 rects 为相对于页面的比例（考虑当前 scale）
      const scaledRects = selectedRects.map(rect => ({
        left: rect.left / scale,
        top: rect.top / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      }));
      
      onAddHighlight(currentPage, selectedText, selectedColor, scaledRects);
      resetSelectionState(true);
    }
  };

  const handleCloseToolbar = () => {
    resetSelectionState(true);
  };

  useEffect(() => {
    isPointerSelectingRef.current = false;
    resetSelectionState(true);
  }, [currentPage, scale, file, resetSelectionState]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#eef0f2] relative flex justify-center p-8"
    >
      {/* PDF Page Container */}
      <div className="relative">
        {/* Page Card */}
        <div 
          className="bg-white rounded-lg shadow-xl overflow-hidden relative"
          style={{ width: pageSize.width, height: pageSize.height }}
        >
          {isLoading && (
            <div className="flex items-center justify-center w-full h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-slate-400">Loading...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center w-full h-full p-8">
              <div className="text-red-500 text-center">
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}
          
          {/* Canvas Layer */}
          <canvas
            ref={canvasRef}
            className="block absolute top-0 left-0"
            style={{
              display: isLoading || error ? 'none' : 'block',
            }}
          />
          
          {/* Text Layer - for selection */}
          <div
            ref={textLayerRef}
            className="absolute top-0 left-0"
            style={{
              display: isLoading || error ? 'none' : 'block',
            }}
          />

          {/* Highlight Layer */}
          {!isLoading && !error && (
            <HighlightLayer
              annotations={annotations}
              page={currentPage}
              scale={scale}
              pageWidth={pageSize.width}
              pageHeight={pageSize.height}
              interactive={interactiveHighlights}
              onAnnotationClick={onHighlightClick}
            />
          )}
        </div>

        {/* Page Number Indicator - Top Right */}
        <div className="absolute -top-6 right-0 text-xs text-slate-400 font-medium">
          {currentPage.toString().padStart(2, '0')}
        </div>
      </div>

      {/* Selection Toolbar */}
      {toolbarPosition && (
        <SelectionToolbar
          position={toolbarPosition}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
          onAction={handleToolbarAction}
          onClose={handleCloseToolbar}
        />
      )}
    </div>
  );
}
