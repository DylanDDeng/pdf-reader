import { useEffect, useRef, useCallback, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
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
  onPageChange?: (page: number) => void;
  onAddHighlight: (
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => void;
  onHighlightClick?: (annotation: Annotation) => void;
  interactiveHighlights?: boolean;
  deleteMode?: boolean;
}

interface PageRefs {
  card: HTMLDivElement | null;
  canvas: HTMLCanvasElement | null;
  textLayerContainer: HTMLDivElement | null;
}

interface PageSize {
  width: number;
  height: number;
}

interface SelectionLayer {
  pageNumber: number;
  layer: HTMLDivElement;
}

interface SelectionInfo {
  text: string;
  rects: Array<{ left: number; top: number; width: number; height: number }>;
  mousePosition: { x: number; y: number };
}

const DEFAULT_PAGE_SIZE: PageSize = { width: 612, height: 792 };
const SCROLL_SYNC_DELAY_MS = 420;

export function PdfViewer({
  file,
  currentPage,
  scale,
  annotations,
  onDocumentLoad,
  onPageChange,
  onAddHighlight,
  onHighlightClick,
  interactiveHighlights = false,
  deleteMode = false,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onDocumentLoadRef = useRef(onDocumentLoad);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const pageRefsRef = useRef<Map<number, PageRefs>>(new Map());
  const textLayerTasksRef = useRef<Map<number, PdfTextLayerTask>>(new Map());
  const renderSeqRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const currentPageRef = useRef(currentPage);
  const isPointerSelectingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const pageChangeFromScrollRef = useRef<number | null>(null);
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectionKeyRef = useRef('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [renderedPages, setRenderedPages] = useState<Record<number, boolean>>({});

  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectedRects, setSelectedRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');

  const destroyTextLayerTasks = useCallback(() => {
    textLayerTasksRef.current.forEach((task) => {
      task.destroy();
    });
    textLayerTasksRef.current.clear();
  }, []);

  const resetSelectionState = useCallback((clearBrowserSelection: boolean = false) => {
    if (clearBrowserSelection) {
      window.getSelection()?.removeAllRanges();
    }

    lastSelectionKeyRef.current = '';
    setSelectedPage(null);
    setToolbarPosition(null);
    setSelectedText('');
    setSelectedRects([]);
  }, []);

  const setPageRefs = useCallback((pageNumber: number, partial: Partial<PageRefs>) => {
    const prev = pageRefsRef.current.get(pageNumber) ?? {
      card: null,
      canvas: null,
      textLayerContainer: null,
    };
    pageRefsRef.current.set(pageNumber, { ...prev, ...partial });
  }, []);

  const waitForPageRefs = useCallback(async (
    pageNumber: number,
    expectedRenderSeq: number
  ): Promise<PageRefs | null> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (expectedRenderSeq !== renderSeqRef.current) {
        return null;
      }
      const refs = pageRefsRef.current.get(pageNumber);
      if (refs?.canvas && refs.textLayerContainer) {
        return refs;
      }
      await new Promise((resolve) => {
        window.setTimeout(resolve, 16);
      });
    }
    return null;
  }, []);

  useEffect(() => {
    onDocumentLoadRef.current = onDocumentLoad;
  }, [onDocumentLoad]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    let isMounted = true;
    const loadSeq = ++renderSeqRef.current;

    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
      setPageCount(0);
      setPageSizes({});
      setRenderedPages({});
      pageRefsRef.current.clear();
      destroyTextLayerTasks();
      resetSelectionState(true);

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
        if (!isMounted || loadSeq !== renderSeqRef.current) {
          doc.destroy();
          return;
        }

        documentRef.current = doc;
        const outline = await extractOutline(doc);
        if (!isMounted || loadSeq !== renderSeqRef.current) {
          return;
        }

        onDocumentLoadRef.current(doc.numPages, outline);
        setPageCount(doc.numPages);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('TextLayer task cancelled')) {
          console.error('Error loading PDF:', err);
        }
        if (isMounted) {
          setError(`Failed to load PDF: ${message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDocument();

    return () => {
      isMounted = false;
      renderSeqRef.current += 1;
      destroyTextLayerTasks();
      if (documentRef.current) {
        documentRef.current.destroy();
        documentRef.current = null;
      }
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [destroyTextLayerTasks, file, resetSelectionState]);

  useEffect(() => {
    const doc = documentRef.current;
    if (!doc || pageCount === 0) {
      return;
    }

    let cancelled = false;
    const renderSeq = ++renderSeqRef.current;
    destroyTextLayerTasks();
    setRenderedPages({});

    const renderAllPages = async () => {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        if (cancelled || renderSeq !== renderSeqRef.current) {
          return;
        }

        try {
          const page = await doc.getPage(pageNumber);
          if (cancelled || renderSeq !== renderSeqRef.current) {
            return;
          }

          const viewport = page.getViewport({ scale });
          setPageSizes((prev) => {
            const currentSize = prev[pageNumber];
            if (
              currentSize &&
              Math.abs(currentSize.width - viewport.width) < 0.1 &&
              Math.abs(currentSize.height - viewport.height) < 0.1
            ) {
              return prev;
            }
            return {
              ...prev,
              [pageNumber]: { width: viewport.width, height: viewport.height },
            };
          });

          const refs = await waitForPageRefs(pageNumber, renderSeq);
          if (!refs?.canvas || !refs.textLayerContainer) {
            continue;
          }

          await renderPage(page, refs.canvas, scale);
          if (cancelled || renderSeq !== renderSeqRef.current) {
            return;
          }

          const previousTask = textLayerTasksRef.current.get(pageNumber) ?? null;
          const nextTask = await renderTextLayer(page, refs.textLayerContainer, scale, previousTask);
          nextTask.element.dataset.pageNumber = String(pageNumber);
          textLayerTasksRef.current.set(pageNumber, nextTask);
          setRenderedPages((prev) => (prev[pageNumber] ? prev : { ...prev, [pageNumber]: true }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes('TextLayer task cancelled')) {
            console.error(`Error rendering page ${pageNumber}:`, err);
          }
        }
      }
    };

    void renderAllPages();

    return () => {
      cancelled = true;
    };
  }, [destroyTextLayerTasks, pageCount, scale, waitForPageRefs]);

  const findPageFromScroll = useCallback(() => {
    if (!onPageChange || isProgrammaticScrollRef.current) {
      return;
    }
    const container = containerRef.current;
    if (!container || pageCount === 0) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const probeX = containerRect.left + containerRect.width / 2;
    const probeY = containerRect.top + Math.min(containerRect.height * 0.35, 260);
    const probeNode = document.elementFromPoint(probeX, probeY) as HTMLElement | null;
    const pageNode = probeNode?.closest<HTMLElement>('[data-page-number]');
    const parsedPage = pageNode?.dataset.pageNumber
      ? Number.parseInt(pageNode.dataset.pageNumber, 10)
      : NaN;
    const nextPage = Number.isFinite(parsedPage) ? parsedPage : currentPageRef.current;
    if (nextPage !== currentPageRef.current) {
      currentPageRef.current = nextPage;
      pageChangeFromScrollRef.current = nextPage;
      onPageChange(nextPage);
    }
  }, [onPageChange, pageCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        return;
      }
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        findPageFromScroll();
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [findPageFromScroll, onPageChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        return;
      }
      const canScroll = container.scrollHeight > container.clientHeight + 1;
      if (!canScroll) {
        return;
      }

      const deltaY = event.deltaY;
      if (Math.abs(deltaY) < 0.1) {
        return;
      }

      const atTop = container.scrollTop <= 0;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
      const scrollingUp = deltaY < 0;
      const scrollingDown = deltaY > 0;
      if ((scrollingUp && atTop) || (scrollingDown && atBottom)) {
        return;
      }

      container.scrollTop += deltaY;
      event.preventDefault();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    if (pageCount === 0) {
      return;
    }
    if (pageChangeFromScrollRef.current === currentPage) {
      pageChangeFromScrollRef.current = null;
      return;
    }
    const card = pageRefsRef.current.get(currentPage)?.card;
    const container = containerRef.current;
    if (!card || !container) {
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const isAlreadyNearTop =
      cardRect.top >= containerRect.top + 8 &&
      cardRect.top <= containerRect.top + Math.max(60, containerRect.height * 0.18);

    if (isAlreadyNearTop) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, SCROLL_SYNC_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [currentPage, pageCount]);

  const getSelectionLayer = useCallback((selection: Selection): SelectionLayer | null => {
    if (selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const resolveLayer = (node: Node): SelectionLayer | null => {
      const element = node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;
      const layer = element?.closest('.textLayer') as HTMLDivElement | null;
      if (!layer) {
        return null;
      }
      const pageAttr = layer.dataset.pageNumber;
      const pageNumber = pageAttr ? Number.parseInt(pageAttr, 10) : NaN;
      if (!Number.isFinite(pageNumber)) {
        return null;
      }
      return { pageNumber, layer };
    };

    const start = resolveLayer(range.startContainer);
    const end = resolveLayer(range.endContainer);
    if (!start || !end) {
      return null;
    }
    if (start.pageNumber !== end.pageNumber || start.layer !== end.layer) {
      return null;
    }
    return start;
  }, []);

  const getSelectionInfo = useCallback((selection: Selection, layer: HTMLDivElement): SelectionInfo | null => {
    if (selection.isCollapsed || !selection.toString().trim() || selection.rangeCount === 0) {
      return null;
    }

    const containerRect = layer.getBoundingClientRect();
    const range = selection.getRangeAt(0);
    const rectList = range.getClientRects();
    if (rectList.length === 0) {
      return null;
    }

    const rects: Array<{ left: number; top: number; width: number; height: number }> = [];
    const acceptedRects: DOMRect[] = [];
    const pageArea = containerRect.width * containerRect.height;

    for (let i = 0; i < rectList.length; i += 1) {
      const rect = rectList[i];
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      if (rect.width >= containerRect.width * 0.98 && rect.height >= containerRect.height * 0.98) {
        continue;
      }
      if (rect.width * rect.height > pageArea * 0.9) {
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

    if (rects.length === 0) {
      return null;
    }

    const lastRect = acceptedRects[acceptedRects.length - 1];
    return {
      text: selection.toString().trim(),
      rects,
      mousePosition: {
        x: lastRect.left + lastRect.width / 2,
        y: lastRect.top,
      },
    };
  }, []);

  const updateSelectionFromWindow = useCallback((clearOnInvalid: boolean = true) => {
    if (deleteMode) {
      if (clearOnInvalid) {
        resetSelectionState(true);
      }
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      if (clearOnInvalid) {
        resetSelectionState();
      }
      return;
    }

    const selectionLayer = getSelectionLayer(selection);
    if (!selectionLayer) {
      if (clearOnInvalid) {
        resetSelectionState();
      }
      return;
    }

    const info = getSelectionInfo(selection, selectionLayer.layer);
    if (!info || info.text.length === 0) {
      if (clearOnInvalid) {
        resetSelectionState();
      }
      return;
    }

    const firstRect = info.rects[0];
    const signature = `${selectionLayer.pageNumber}:${info.text}:${info.rects.length}:${Math.round(firstRect.left)}:${Math.round(firstRect.top)}`;
    if (signature === lastSelectionKeyRef.current) {
      return;
    }

    lastSelectionKeyRef.current = signature;
    setSelectedPage(selectionLayer.pageNumber);
    setSelectedText(info.text);
    setSelectedRects(info.rects);
    setToolbarPosition(info.mousePosition);
  }, [deleteMode, getSelectionInfo, getSelectionLayer, resetSelectionState]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (deleteMode) {
        return;
      }
      if (!(event.target instanceof Node)) {
        return;
      }
      const element = event.target.nodeType === Node.ELEMENT_NODE
        ? (event.target as HTMLElement)
        : event.target.parentElement;
      const layer = element?.closest('.textLayer');
      if (!layer) {
        return;
      }

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
  }, [deleteMode, updateSelectionFromWindow]);

  const handleToolbarAction = (action: AnnotationAction) => {
    if (action !== 'highlight' || !selectedText || selectedRects.length === 0 || !selectedPage) {
      return;
    }

    const scaledRects = selectedRects.map((rect) => ({
      left: rect.left / scale,
      top: rect.top / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }));

    onAddHighlight(selectedPage, selectedText, selectedColor, scaledRects);
    resetSelectionState(true);
  };

  const handleCloseToolbar = () => {
    resetSelectionState(true);
  };

  useEffect(() => {
    isPointerSelectingRef.current = false;
    resetSelectionState(true);
  }, [file, scale, resetSelectionState]);

  useEffect(() => {
    if (deleteMode) {
      isPointerSelectingRef.current = false;
      resetSelectionState(true);
    }
  }, [deleteMode, resetSelectionState]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto overflow-x-auto bg-[#eef0f2] relative"
      style={{ scrollbarGutter: 'stable both-edges' }}
    >
      <div className="min-h-full flex flex-col items-center gap-8 px-8 py-8">
        {isLoading && (
          <div className="flex items-center justify-center w-full py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Loading...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center w-full py-20">
            <div className="text-red-500 text-center">
              <p className="font-medium mb-1">Error</p>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {!error && !isLoading && pageCount > 0 && (
          Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => {
            const pageSize = pageSizes[pageNumber] ?? {
              width: DEFAULT_PAGE_SIZE.width * scale,
              height: DEFAULT_PAGE_SIZE.height * scale,
            };
            const isRendered = Boolean(renderedPages[pageNumber]);

            return (
              <div
                key={pageNumber}
                className="relative"
                data-page-number={pageNumber}
                ref={(node) => {
                  setPageRefs(pageNumber, { card: node });
                }}
              >
                <div
                  className="bg-white rounded-lg shadow-xl overflow-hidden relative"
                  style={{ width: pageSize.width, height: pageSize.height }}
                >
                  {!isRendered && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                      <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                  )}

                  <canvas
                    ref={(node) => {
                      setPageRefs(pageNumber, { canvas: node });
                    }}
                    className="block absolute top-0 left-0"
                    style={{ display: isRendered ? 'block' : 'none' }}
                  />

                  <div
                    ref={(node) => {
                      setPageRefs(pageNumber, { textLayerContainer: node });
                    }}
                    className="absolute top-0 left-0"
                    style={{
                      display: isRendered ? 'block' : 'none',
                      pointerEvents: deleteMode ? 'none' : 'auto',
                    }}
                  />

                  {isRendered && (
                    <HighlightLayer
                      annotations={annotations}
                      page={pageNumber}
                      scale={scale}
                      pageWidth={pageSize.width}
                      pageHeight={pageSize.height}
                      interactive={interactiveHighlights || deleteMode}
                      deleteMode={deleteMode}
                      onAnnotationClick={onHighlightClick}
                    />
                  )}
                </div>

                <div className="absolute -top-6 right-0 text-xs text-slate-400 font-medium">
                  {pageNumber.toString().padStart(2, '0')}
                </div>
              </div>
            );
          })
        )}
      </div>

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
