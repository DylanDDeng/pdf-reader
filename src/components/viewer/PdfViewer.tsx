import { useEffect, useRef, useCallback, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  loadPdfDocument,
  startRenderPage,
  renderTextLayer,
  extractOutline,
  type OutlineItem,
  type PdfCanvasRenderTask,
  type PdfTextLayerTask,
} from '../../utils/pdf';
import { HighlightLayer } from './HighlightLayer';
import { SelectionToolbar, type AnnotationAction } from './SelectionToolbar';
import type { Annotation, HighlightColor } from '../../types/annotation';
import { streamOpenRouterChatCompletion } from '../../services/aiService';
import { AiServiceError, type AiRequestMode, type AiRuntimeConfig } from '../../types/ai';

interface PdfViewerProps {
  file: File | string;
  currentPage: number;
  scale: number;
  isActive?: boolean;
  fitWidthMode?: boolean;
  onFitWidthScaleCalculated?: (scale: number) => void;
  annotations: Annotation[];
  onDocumentLoad: (totalPages: number, outline: OutlineItem[]) => void;
  onPageChange?: (page: number) => void;
  onAddHighlight: (
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => void;
  onAddUnderline: (
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => void;
  onHighlightClick?: (annotation: Annotation, context?: AnnotationClickContext) => void;
  interactiveHighlights?: boolean;
  deleteMode?: boolean;
  aiConfig: AiRuntimeConfig;
  onAiRequestFinished?: (success: boolean) => void;
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

interface LayerPointerInfo {
  pageNumber: number;
  x: number;
  y: number;
}

export interface AnnotationClickContext {
  clientX: number;
  clientY: number;
}

const DEFAULT_PAGE_SIZE: PageSize = { width: 612, height: 792 };
const SCROLL_SYNC_DELAY_MS = 420;
const CANVAS_BUFFER_VIEWPORTS = 2.5;
const TEXT_BUFFER_VIEWPORTS = 0.9;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const FIT_WIDTH_HORIZONTAL_PADDING = 80;
const RENDER_RETRY_DELAY_MS = 90;
const RENDER_RETRY_MAX_DELAY_MS = 720;
const RENDER_RETRY_MAX_ATTEMPTS = 5;

function clampPage(page: number, totalPages: number): number {
  const normalized = Number.isFinite(page) ? Math.floor(page) : 1;
  if (totalPages <= 0) {
    return Math.max(1, normalized);
  }
  return Math.max(1, Math.min(normalized, totalPages));
}

function isRenderCancellationError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('cancel') ||
    message.includes('aborted') ||
    message.includes('rendering cancelled') ||
    message.includes('textlayer task cancelled')
  );
}

export function PdfViewer({
  file,
  currentPage,
  scale,
  isActive = true,
  fitWidthMode = false,
  onFitWidthScaleCalculated,
  annotations,
  onDocumentLoad,
  onPageChange,
  onAddHighlight,
  onAddUnderline,
  onHighlightClick,
  interactiveHighlights = false,
  deleteMode = false,
  aiConfig,
  onAiRequestFinished,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onDocumentLoadRef = useRef(onDocumentLoad);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const pageRefsRef = useRef<Map<number, PageRefs>>(new Map());
  const textLayerTasksRef = useRef<Map<number, PdfTextLayerTask>>(new Map());
  const renderSeqRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const prevIsActiveRef = useRef(isActive);
  const currentPageRef = useRef(currentPage);
  const isPointerSelectingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const pageChangeFromScrollRef = useRef<number | null>(null);
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionRenderUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionRenderLockRef = useRef(false);
  const suppressSelectionEventsRef = useRef(false);
  const pendingReadyPageRef = useRef<number | null>(null);
  const lastSelectionKeyRef = useRef('');
  const canvasRenderLocksRef = useRef<Map<number, Promise<void>>>(new Map());
  const canvasRenderTasksRef = useRef<Map<number, PdfCanvasRenderTask>>(new Map());
  const textRenderLocksRef = useRef<Map<number, Promise<void>>>(new Map());
  const renderedCanvasScaleRef = useRef<Map<number, number>>(new Map());
  const renderedTextScaleRef = useRef<Map<number, number>>(new Map());
  const scheduleVisiblePageRenderRef = useRef<() => void>(() => {});
  const lastLayerPointerRef = useRef<LayerPointerInfo | null>(null);
  const pendingRenderRetryRef = useRef<Map<string, number>>(new Map());
  const renderRetryAttemptsRef = useRef<Map<string, number>>(new Map());

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [basePageWidth, setBasePageWidth] = useState<number | null>(null);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [renderedPages, setRenderedPages] = useState<Record<number, boolean>>({});

  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectedRects, setSelectedRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [aiState, setAiState] = useState<{
    open: boolean;
    mode: AiRequestMode;
    status: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
    title: string;
    question: string;
    content: string;
    error: string | null;
    warning: string | null;
  }>({
    open: false,
    mode: 'summary',
    status: 'idle',
    title: '',
    question: '',
    content: '',
    error: null,
    warning: null,
  });

  const aiAbortRef = useRef<AbortController | null>(null);

  const destroyTextLayerTasks = useCallback(() => {
    textLayerTasksRef.current.forEach((task) => {
      task.destroy();
    });
    textLayerTasksRef.current.clear();
  }, []);

  const cancelAllCanvasRenderTasks = useCallback(() => {
    canvasRenderTasksRef.current.forEach((task) => {
      task.cancel();
    });
    canvasRenderTasksRef.current.clear();
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

  const resetRenderCaches = useCallback((clearSizes: boolean = false) => {
    cancelAllCanvasRenderTasks();
    canvasRenderLocksRef.current.clear();
    textRenderLocksRef.current.clear();
    renderedCanvasScaleRef.current.clear();
    renderedTextScaleRef.current.clear();
    destroyTextLayerTasks();
    setRenderedPages({});
    if (clearSizes) {
      setPageSizes({});
    }
  }, [cancelAllCanvasRenderTasks, destroyTextLayerTasks]);

  const setPageRefs = useCallback((pageNumber: number, partial: Partial<PageRefs>) => {
    const prev = pageRefsRef.current.get(pageNumber) ?? {
      card: null,
      canvas: null,
      textLayerContainer: null,
    };
    pageRefsRef.current.set(pageNumber, { ...prev, ...partial });
  }, []);

  const clearAllRenderRetryTimers = useCallback(() => {
    pendingRenderRetryRef.current.forEach((timerId) => {
      clearTimeout(timerId);
    });
    pendingRenderRetryRef.current.clear();
    renderRetryAttemptsRef.current.clear();
  }, []);

  const clearRenderRetry = useCallback((pageNumber: number, expectedRenderSeq: number) => {
    if (!Number.isFinite(pageNumber) || pageNumber < 1) {
      return;
    }
    const key = `${expectedRenderSeq}:${Math.floor(pageNumber)}`;
    const timerId = pendingRenderRetryRef.current.get(key);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      pendingRenderRetryRef.current.delete(key);
    }
    renderRetryAttemptsRef.current.delete(key);
  }, []);

  const scheduleRenderRetry = useCallback((pageNumber: number, expectedRenderSeq: number) => {
    if (expectedRenderSeq !== renderSeqRef.current || pageCount <= 0) {
      return;
    }
    if (!Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
      return;
    }

    const key = `${expectedRenderSeq}:${Math.floor(pageNumber)}`;
    if (pendingRenderRetryRef.current.has(key)) {
      return;
    }

    const attempt = (renderRetryAttemptsRef.current.get(key) ?? 0) + 1;
    if (attempt > RENDER_RETRY_MAX_ATTEMPTS) {
      return;
    }
    renderRetryAttemptsRef.current.set(key, attempt);
    const retryDelay = Math.min(RENDER_RETRY_DELAY_MS * (2 ** (attempt - 1)), RENDER_RETRY_MAX_DELAY_MS);

    const timerId = window.setTimeout(() => {
      if (pendingRenderRetryRef.current.get(key) !== timerId) {
        return;
      }
      pendingRenderRetryRef.current.delete(key);

      if (expectedRenderSeq !== renderSeqRef.current) {
        return;
      }

      scheduleVisiblePageRenderRef.current();
    }, retryDelay);

    pendingRenderRetryRef.current.set(key, timerId);
  }, [pageCount]);

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
      setBasePageWidth(null);
      currentPageRef.current = Math.max(1, Math.floor(currentPage || 1));
      pageRefsRef.current.clear();
      resetRenderCaches(true);
      resetSelectionState(true);
      clearAllRenderRetryTimers();

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
        const firstPage = await doc.getPage(1);
        if (!isMounted || loadSeq !== renderSeqRef.current) {
          return;
        }
        const baseViewport = firstPage.getViewport({ scale: 1 });
        setBasePageWidth(baseViewport.width);
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
      resetRenderCaches(true);
      if (documentRef.current) {
        documentRef.current.destroy();
        documentRef.current = null;
      }
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      if (selectionRenderUnlockTimerRef.current) {
        clearTimeout(selectionRenderUnlockTimerRef.current);
      }
      suppressSelectionEventsRef.current = false;
      pendingReadyPageRef.current = null;
      isProgrammaticScrollRef.current = false;
      clearAllRenderRetryTimers();
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [clearAllRenderRetryTimers, file, resetRenderCaches, resetSelectionState]);

  const calculateFitWidthScale = useCallback(() => {
    if (!fitWidthMode || !onFitWidthScaleCalculated) {
      return;
    }
    if (!basePageWidth || basePageWidth <= 0) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const availableWidth = container.clientWidth - FIT_WIDTH_HORIZONTAL_PADDING;
    if (availableWidth <= 0) {
      return;
    }

    const nextScale = Math.max(MIN_SCALE, Math.min(availableWidth / basePageWidth, MAX_SCALE));
    if (Math.abs(nextScale - scale) <= 0.01) {
      return;
    }

    onFitWidthScaleCalculated(nextScale);
  }, [basePageWidth, fitWidthMode, onFitWidthScaleCalculated, scale]);

  useEffect(() => {
    if (!isActive || !fitWidthMode) {
      return;
    }

    calculateFitWidthScale();

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (typeof ResizeObserver !== 'undefined') {
      let rafId: number | null = null;
      const observer = new ResizeObserver(() => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          rafId = null;
          calculateFitWidthScale();
        });
      });

      observer.observe(container);

      return () => {
        observer.disconnect();
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
      };
    }

    const handleResize = () => {
      calculateFitWidthScale();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateFitWidthScale, fitWidthMode, isActive]);

  const ensurePageCanvas = useCallback(async (pageNumber: number, expectedRenderSeq: number) => {
    if (expectedRenderSeq !== renderSeqRef.current) {
      return;
    }
    if (!Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
      return;
    }
    const doc = documentRef.current;
    if (!doc) {
      return;
    }
    const cachedScale = renderedCanvasScaleRef.current.get(pageNumber);
    if (cachedScale === scale) {
      return;
    }

    const inFlight = canvasRenderLocksRef.current.get(pageNumber);
    if (inFlight) {
      try {
        await inFlight;
      } catch {
        // Ignore and allow follow-up attempts in next render cycle.
      }
      if (expectedRenderSeq === renderSeqRef.current && renderedCanvasScaleRef.current.get(pageNumber) !== scale) {
        scheduleRenderRetry(pageNumber, expectedRenderSeq);
      }
      return;
    }

    const task = (async () => {
      const page = await doc.getPage(pageNumber);
      if (expectedRenderSeq !== renderSeqRef.current) {
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

      const refs = await waitForPageRefs(pageNumber, expectedRenderSeq);
      if (!refs?.canvas) {
        scheduleRenderRetry(pageNumber, expectedRenderSeq);
        return;
      }

      const renderTask = startRenderPage(page, refs.canvas, scale);
      canvasRenderTasksRef.current.set(pageNumber, renderTask);
      await renderTask.promise;
      if (canvasRenderTasksRef.current.get(pageNumber) === renderTask) {
        canvasRenderTasksRef.current.delete(pageNumber);
      }
      if (expectedRenderSeq !== renderSeqRef.current) {
        return;
      }

      renderedCanvasScaleRef.current.set(pageNumber, scale);
      clearRenderRetry(pageNumber, expectedRenderSeq);
      setRenderedPages((prev) => (prev[pageNumber] ? prev : { ...prev, [pageNumber]: true }));
    })();

    canvasRenderLocksRef.current.set(pageNumber, task);
    try {
      await task;
    } catch (err) {
      if (!isRenderCancellationError(err)) {
        console.error(`Error rendering canvas for page ${pageNumber}:`, err);
        scheduleRenderRetry(pageNumber, expectedRenderSeq);
      }
    } finally {
      canvasRenderTasksRef.current.delete(pageNumber);
      if (canvasRenderLocksRef.current.get(pageNumber) === task) {
        canvasRenderLocksRef.current.delete(pageNumber);
      }
    }
  }, [clearRenderRetry, pageCount, scale, scheduleRenderRetry, waitForPageRefs]);

  const ensurePageTextLayer = useCallback(async (pageNumber: number, expectedRenderSeq: number) => {
    if (deleteMode || expectedRenderSeq !== renderSeqRef.current) {
      return;
    }
    if (!Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
      return;
    }
    const doc = documentRef.current;
    if (!doc) {
      return;
    }
    const cachedScale = renderedTextScaleRef.current.get(pageNumber);
    if (cachedScale === scale) {
      return;
    }

    const inFlight = textRenderLocksRef.current.get(pageNumber);
    if (inFlight) {
      try {
        await inFlight;
      } catch {
        // Ignore and allow follow-up attempts in next render cycle.
      }
      if (expectedRenderSeq === renderSeqRef.current && renderedTextScaleRef.current.get(pageNumber) !== scale) {
        scheduleRenderRetry(pageNumber, expectedRenderSeq);
      }
      return;
    }

    const task = (async () => {
      const page = await doc.getPage(pageNumber);
      if (expectedRenderSeq !== renderSeqRef.current) {
        return;
      }

      const refs = await waitForPageRefs(pageNumber, expectedRenderSeq);
      if (!refs?.textLayerContainer) {
        scheduleRenderRetry(pageNumber, expectedRenderSeq);
        return;
      }

      const previousTask = textLayerTasksRef.current.get(pageNumber) ?? null;
      const nextTask = await renderTextLayer(page, refs.textLayerContainer, scale, previousTask);
      nextTask.element.dataset.pageNumber = String(pageNumber);
      textLayerTasksRef.current.set(pageNumber, nextTask);
      renderedTextScaleRef.current.set(pageNumber, scale);
      clearRenderRetry(pageNumber, expectedRenderSeq);
    })();

    textRenderLocksRef.current.set(pageNumber, task);
    try {
      await task;
    } catch (err) {
      if (!isRenderCancellationError(err)) {
        console.error(`Error rendering text layer for page ${pageNumber}:`, err);
        scheduleRenderRetry(pageNumber, expectedRenderSeq);
      }
    } finally {
      if (textRenderLocksRef.current.get(pageNumber) === task) {
        textRenderLocksRef.current.delete(pageNumber);
      }
    }
  }, [clearRenderRetry, deleteMode, pageCount, scale, scheduleRenderRetry, waitForPageRefs]);

  const isPageTextLayerReady = useCallback((pageNumber: number, layer?: HTMLDivElement | null): boolean => {
    if (!Number.isFinite(pageNumber) || pageNumber < 1) {
      return false;
    }
    if (layer && !layer.isConnected) {
      return false;
    }
    if (renderedTextScaleRef.current.get(pageNumber) !== scale) {
      return false;
    }
    if (textRenderLocksRef.current.has(pageNumber)) {
      return false;
    }
    const task = textLayerTasksRef.current.get(pageNumber);
    if (!task || !task.element.isConnected) {
      return false;
    }
    return true;
  }, [scale]);

  const collectRenderTargets = useCallback(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0) {
      return {
        canvas: [] as number[],
        text: new Set<number>(),
      };
    }

    const containerRect = container.getBoundingClientRect();
    const viewportHeight = container.clientHeight;
    const canvasTop = containerRect.top - viewportHeight * CANVAS_BUFFER_VIEWPORTS;
    const canvasBottom = containerRect.bottom + viewportHeight * CANVAS_BUFFER_VIEWPORTS;
    const textTop = containerRect.top - viewportHeight * TEXT_BUFFER_VIEWPORTS;
    const textBottom = containerRect.bottom + viewportHeight * TEXT_BUFFER_VIEWPORTS;
    const viewportCenter = containerRect.top + viewportHeight / 2;
    const safeCurrentPage = clampPage(currentPageRef.current, pageCount);

    const canvasCandidates: Array<{ page: number; distance: number }> = [];
    const textPages = new Set<number>();

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const card = pageRefsRef.current.get(pageNumber)?.card;
      if (!card) {
        continue;
      }

      const rect = card.getBoundingClientRect();
      if (rect.bottom >= canvasTop && rect.top <= canvasBottom) {
        canvasCandidates.push({
          page: pageNumber,
          distance: Math.abs((rect.top + rect.bottom) / 2 - viewportCenter),
        });
      }

      if (rect.bottom >= textTop && rect.top <= textBottom) {
        textPages.add(pageNumber);
      }
    }

    if (canvasCandidates.length === 0 && safeCurrentPage >= 1 && safeCurrentPage <= pageCount) {
      canvasCandidates.push({ page: safeCurrentPage, distance: 0 });
      textPages.add(safeCurrentPage);
    }

    canvasCandidates.sort((a, b) => a.distance - b.distance);
    return {
      canvas: canvasCandidates.map((item) => item.page),
      text: textPages,
    };
  }, [pageCount]);

  const pruneFarLayers = useCallback((keptCanvas: Set<number>, keptText: Set<number>) => {
    const pagesToHide: number[] = [];

    textLayerTasksRef.current.forEach((task, pageNumber) => {
      if (keptText.has(pageNumber)) {
        return;
      }
      if (textRenderLocksRef.current.has(pageNumber)) {
        return;
      }
      task.destroy();
      textLayerTasksRef.current.delete(pageNumber);
      renderedTextScaleRef.current.delete(pageNumber);
    });

    renderedCanvasScaleRef.current.forEach((_scale, pageNumber) => {
      if (keptCanvas.has(pageNumber)) {
        return;
      }
      if (canvasRenderLocksRef.current.has(pageNumber)) {
        return;
      }
      const refs = pageRefsRef.current.get(pageNumber);
      if (refs?.canvas) {
        refs.canvas.width = 0;
        refs.canvas.height = 0;
        refs.canvas.style.width = '0px';
        refs.canvas.style.height = '0px';
      }
      renderedCanvasScaleRef.current.delete(pageNumber);
      pagesToHide.push(pageNumber);
    });

    if (pagesToHide.length > 0) {
      setRenderedPages((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const pageNumber of pagesToHide) {
          if (next[pageNumber]) {
            delete next[pageNumber];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, []);

  const scheduleVisiblePageRender = useCallback(() => {
    if (!isActive) {
      return;
    }
    if (!documentRef.current || pageCount === 0) {
      return;
    }

    const selectionLocked = selectionRenderLockRef.current || toolbarPosition !== null;
    const expectedRenderSeq = renderSeqRef.current;
    const safeCurrentPage = clampPage(currentPageRef.current, pageCount);
    const { canvas, text } = collectRenderTargets();
    const canvasSet = new Set(canvas);

    const keptText = new Set<number>();
    if (!deleteMode) {
      text.forEach((pageNumber) => keptText.add(pageNumber));
    }

    if (selectedPage) {
      canvasSet.add(selectedPage);
      if (!deleteMode) {
        keptText.add(selectedPage);
      }
    }

    if (safeCurrentPage >= 1 && safeCurrentPage <= pageCount) {
      canvasSet.add(safeCurrentPage);
      if (!deleteMode) {
        keptText.add(safeCurrentPage);
      }
    }

    if (selectionLocked) {
      textLayerTasksRef.current.forEach((_task, pageNumber) => {
        keptText.add(pageNumber);
      });
    } else {
      pruneFarLayers(canvasSet, keptText);
    }

    const orderedCanvas = Array.from(canvasSet).sort((a, b) => {
      const da = Math.abs(a - safeCurrentPage);
      const db = Math.abs(b - safeCurrentPage);
      return da - db;
    });

    for (const pageNumber of orderedCanvas) {
      void ensurePageCanvas(pageNumber, expectedRenderSeq);
    }

    if (deleteMode || selectionLocked) {
      return;
    }

    const orderedText = Array.from(keptText).sort((a, b) => {
      const da = Math.abs(a - safeCurrentPage);
      const db = Math.abs(b - safeCurrentPage);
      return da - db;
    });

    for (const pageNumber of orderedText) {
      void ensurePageTextLayer(pageNumber, expectedRenderSeq);
    }
  }, [collectRenderTargets, deleteMode, ensurePageCanvas, ensurePageTextLayer, isActive, pageCount, pruneFarLayers, selectedPage, toolbarPosition]);

  useEffect(() => {
    scheduleVisiblePageRenderRef.current = scheduleVisiblePageRender;
  }, [scheduleVisiblePageRender]);

  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isActive;

    if (!isActive) {
      cancelAllCanvasRenderTasks();
      clearAllRenderRetryTimers();
    }

    if (!wasActive && isActive && pageCount > 0) {
      scheduleVisiblePageRenderRef.current();
    }
  }, [cancelAllCanvasRenderTasks, clearAllRenderRetryTimers, isActive, pageCount]);

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
    const nextPage = Number.isFinite(parsedPage)
      ? clampPage(parsedPage, pageCount)
      : clampPage(currentPageRef.current, pageCount);
    if (nextPage !== currentPageRef.current) {
      currentPageRef.current = nextPage;
      pageChangeFromScrollRef.current = nextPage;
      onPageChange(nextPage);
    }
  }, [onPageChange, pageCount]);

  useEffect(() => {
    if (pageCount === 0) {
      return;
    }
    clearAllRenderRetryTimers();
    renderSeqRef.current += 1;
    resetRenderCaches(true);
    scheduleVisiblePageRenderRef.current();
  }, [clearAllRenderRetryTimers, pageCount, scale, resetRenderCaches]);

  useEffect(() => {
    if (pageCount === 0) {
      return;
    }
    scheduleVisiblePageRenderRef.current();
  }, [deleteMode, pageCount]);

  useEffect(() => {
    if (!isActive || deleteMode || pageCount === 0 || currentPage < 1) {
      return;
    }
    const expectedRenderSeq = renderSeqRef.current;
    void ensurePageTextLayer(currentPage, expectedRenderSeq);
    if (currentPage > 1) {
      void ensurePageTextLayer(currentPage - 1, expectedRenderSeq);
    }
    if (currentPage < pageCount) {
      void ensurePageTextLayer(currentPage + 1, expectedRenderSeq);
    }
  }, [currentPage, deleteMode, ensurePageTextLayer, isActive, pageCount]);

  useEffect(() => {
    if (pageCount === 0) {
      return;
    }
    scheduleVisiblePageRenderRef.current();
  }, [currentPage, pageCount]);

  useEffect(() => {
    if (!isActive) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        if (!isProgrammaticScrollRef.current) {
          findPageFromScroll();
        }
        scheduleVisiblePageRenderRef.current();
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      isProgrammaticScrollRef.current = false;
    };
  }, [findPageFromScroll, isActive]);

  useEffect(() => {
    if (!isActive || pageCount === 0) {
      isProgrammaticScrollRef.current = false;
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
      isProgrammaticScrollRef.current = false;
    };
  }, [currentPage, isActive, pageCount]);

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
      if (!layer.isConnected) {
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

  const findAnnotationAtLayerPoint = useCallback((
    pageNumber: number,
    x: number,
    y: number
  ): Annotation | null => {
    const pageAnnotations = annotations.filter((ann) => ann.page === pageNumber);
    if (pageAnnotations.length === 0) {
      return null;
    }

    const hitPadding = 2;
    const underlinePadding = 5;

    for (let i = pageAnnotations.length - 1; i >= 0; i -= 1) {
      const annotation = pageAnnotations[i];
      const type = annotation.type ?? 'highlight';

      for (const rect of annotation.rects) {
        const left = rect.left * scale;
        const top = rect.top * scale;
        const width = rect.width * scale;
        const height = rect.height * scale;

        if (type === 'underline') {
          const underlineThickness = Math.max(2, Math.round(scale * 1.4));
          const underlineTop = Math.max(top + height - underlineThickness, top);
          const inUnderlineX = x >= left - underlinePadding && x <= left + width + underlinePadding;
          const inUnderlineY = y >= underlineTop - underlinePadding && y <= underlineTop + underlineThickness + underlinePadding;
          if (inUnderlineX && inUnderlineY) {
            return annotation;
          }
          continue;
        }

        const inRectX = x >= left - hitPadding && x <= left + width + hitPadding;
        const inRectY = y >= top - hitPadding && y <= top + height + hitPadding;
        if (inRectX && inRectY) {
          return annotation;
        }
      }
    }

    return null;
  }, [annotations, scale]);

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
    if (!isPageTextLayerReady(selectionLayer.pageNumber, selectionLayer.layer)) {
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
  }, [deleteMode, getSelectionInfo, getSelectionLayer, isPageTextLayerReady, resetSelectionState]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
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
      const layer = element?.closest('.textLayer') as HTMLDivElement | null;
      if (!layer) {
        lastLayerPointerRef.current = null;
      }
      if (!layer) {
        return;
      }
      const layerRect = layer.getBoundingClientRect();
      const pageAttr = (layer as HTMLDivElement).dataset.pageNumber;
      const pageNumber = pageAttr ? Number.parseInt(pageAttr, 10) : NaN;
      if (Number.isFinite(pageNumber)) {
        lastLayerPointerRef.current = {
          pageNumber,
          x: event.clientX - layerRect.left,
          y: event.clientY - layerRect.top,
        };
      }
      if (!isPageTextLayerReady(pageNumber, layer as HTMLDivElement)) {
        suppressSelectionEventsRef.current = true;
        pendingReadyPageRef.current = Number.isFinite(pageNumber) ? pageNumber : null;
        resetSelectionState(true);
        event.preventDefault();
        event.stopPropagation();
        if (Number.isFinite(pageNumber) && pageNumber > 0) {
          void ensurePageTextLayer(pageNumber, renderSeqRef.current).finally(() => {
            if (pendingReadyPageRef.current === pageNumber) {
              suppressSelectionEventsRef.current = false;
              pendingReadyPageRef.current = null;
            }
          });
        }
        scheduleVisiblePageRenderRef.current();
        return;
      }

      suppressSelectionEventsRef.current = false;
      pendingReadyPageRef.current = null;
      selectionRenderLockRef.current = true;
      if (selectionRenderUnlockTimerRef.current) {
        clearTimeout(selectionRenderUnlockTimerRef.current);
        selectionRenderUnlockTimerRef.current = null;
      }
      isPointerSelectingRef.current = true;
      setToolbarPosition(null);
    };

    const handlePointerUp = () => {
      if (suppressSelectionEventsRef.current) {
        suppressSelectionEventsRef.current = false;
        pendingReadyPageRef.current = null;
        return;
      }
      if (!isPointerSelectingRef.current) {
        return;
      }
      isPointerSelectingRef.current = false;
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      selectionTimeoutRef.current = setTimeout(() => {
        updateSelectionFromWindow(true);
        selectionRenderUnlockTimerRef.current = setTimeout(() => {
          selectionRenderLockRef.current = false;
          selectionRenderUnlockTimerRef.current = null;
          scheduleVisiblePageRenderRef.current();
        }, 120);
      }, 20);
    };

    const handleClick = (event: MouseEvent) => {
      if (deleteMode || !onHighlightClick) {
        return;
      }

      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
        return;
      }
      if (toolbarPosition) {
        return;
      }

      const element = event.target instanceof Node
        ? (event.target.nodeType === Node.ELEMENT_NODE
            ? (event.target as HTMLElement)
            : event.target.parentElement)
        : null;
      const layer = element?.closest('.textLayer') as HTMLDivElement | null;
      if (!layer || !layer.isConnected) {
        return;
      }

      const pageAttr = layer.dataset.pageNumber;
      const pageNumber = pageAttr ? Number.parseInt(pageAttr, 10) : NaN;
      if (!Number.isFinite(pageNumber)) {
        return;
      }

      const layerRect = layer.getBoundingClientRect();
      const clickX = event.clientX - layerRect.left;
      const clickY = event.clientY - layerRect.top;

      const pointer = lastLayerPointerRef.current;
      const hasPointerPoint = Boolean(pointer && pointer.pageNumber === pageNumber);
      const hitX = hasPointerPoint ? pointer!.x : clickX;
      const hitY = hasPointerPoint ? pointer!.y : clickY;

      const annotation = findAnnotationAtLayerPoint(pageNumber, hitX, hitY);
      if (!annotation) {
        return;
      }

      event.stopPropagation();
      const sourceClient = hasPointerPoint
        ? { clientX: layerRect.left + hitX, clientY: layerRect.top + hitY }
        : { clientX: event.clientX, clientY: event.clientY };

      onHighlightClick(annotation, sourceClient);
    };

    const handleSelectionChange = () => {
      if (suppressSelectionEventsRef.current) {
        return;
      }
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
    document.addEventListener('click', handleClick, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keyup', handleKeySelection, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keyup', handleKeySelection, true);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      if (selectionRenderUnlockTimerRef.current) {
        clearTimeout(selectionRenderUnlockTimerRef.current);
      }
      suppressSelectionEventsRef.current = false;
      pendingReadyPageRef.current = null;
      lastLayerPointerRef.current = null;
      selectionRenderLockRef.current = false;
      selectionRenderUnlockTimerRef.current = null;
    };
  }, [
    deleteMode,
    ensurePageTextLayer,
    findAnnotationAtLayerPoint,
    isActive,
    isPageTextLayerReady,
    onHighlightClick,
    resetSelectionState,
    toolbarPosition,
    updateSelectionFromWindow,
  ]);

  const closeAiPanel = () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiState((prev) => ({ ...prev, open: false, status: 'idle' }));
  };

  const getAiErrorMessage = (error: unknown): string => {
    if (error instanceof AiServiceError) {
      if (error.code === 'AUTH_INVALID') {
        return 'OpenRouter API Key 无效，请检查设置。';
      }
      if (error.code === 'RATE_LIMIT') {
        return 'OpenRouter 触发限流，请稍后重试。';
      }
      if (error.code === 'NETWORK_ERROR') {
        return '网络请求失败，请检查网络连接。';
      }
      if (error.code === 'ABORTED') {
        return '请求已取消。';
      }
      if (error.code === 'INVALID_CONFIG') {
        return '请先在设置中填写 OpenRouter API Key 和模型。';
      }
      return error.message || 'AI 请求失败。';
    }
    return error instanceof Error ? error.message : 'AI 请求失败。';
  };

  const runAiAction = async (mode: AiRequestMode) => {
    if (!selectedText || selectedRects.length === 0 || !selectedPage) {
      return;
    }
    if (!aiConfig.enabled) {
      setAiState({
        open: true,
        mode,
        status: 'error',
        title: 'AI 未启用',
        question: '',
        content: '',
        error: 'AI 功能当前已关闭，请在设置中启用。',
        warning: null,
      });
      return;
    }
    const normalizedApiKey = aiConfig.apiKey.trim();
    const normalizedModel = aiConfig.model.trim();

    if (!normalizedApiKey || !normalizedModel) {
      const missingConfigMessage = !normalizedApiKey && !normalizedModel
        ? '请先在设置中配置 OpenRouter API Key 和模型。'
        : !normalizedApiKey
          ? '请先在设置中配置 OpenRouter API Key。'
          : '请先在设置中配置 OpenRouter 模型。';
      setAiState({
        open: true,
        mode,
        status: 'error',
        title: '配置缺失',
        question: '',
        content: '',
        error: missingConfigMessage,
        warning: null,
      });
      return;
    }

    let question = '';
    if (mode === 'ask') {
      const input = window.prompt('请输入你想问 AI 的问题');
      if (!input || !input.trim()) {
        return;
      }
      question = input.trim();
    }

    const warning =
      aiConfig.todayRequestCount >= aiConfig.dailyUsageSoftLimit
        ? `今日调用已达到 ${aiConfig.todayRequestCount} 次，超过提醒阈值 ${aiConfig.dailyUsageSoftLimit}。`
        : null;

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    const title = mode === 'summary' ? 'AI 总结' : 'AI 问答';
    setAiState({
      open: true,
      mode,
      status: 'loading',
      title,
      question,
      content: '',
      error: null,
      warning,
    });

    const systemPrompt = mode === 'summary'
      ? '你是一个严谨的中文学术阅读助手。请对用户给出的选中文本做精炼的段落式摘要，语言简洁连贯，不要使用列表或要点形式，不要编造未出现的信息。'
      : '你是一个严谨的中文学术阅读助手。请仅基于用户给出的选中文本回答问题；若信息不足，请明确说明信息不足。';

    const userPrompt = mode === 'summary'
      ? `请总结下面这段选中文本：\n\n${selectedText}`
      : `选中文本：\n${selectedText}\n\n问题：${question}`;

    try {
      await streamOpenRouterChatCompletion({
        apiKey: normalizedApiKey,
        model: normalizedModel,
        reasoningEnabled: aiConfig.reasoningEnabled,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        signal: controller.signal,
        onDelta: (chunk) => {
          setAiState((prev) => ({
            ...prev,
            open: true,
            status: 'streaming',
            content: prev.content + chunk,
          }));
        },
      });
      setAiState((prev) => ({
        ...prev,
        status: 'done',
        error: null,
      }));
      onAiRequestFinished?.(true);
    } catch (error) {
      if (error instanceof AiServiceError && error.code === 'ABORTED') {
        setAiState((prev) => ({
          ...prev,
          status: 'idle',
          error: null,
        }));
        return;
      }
      setAiState((prev) => ({
        ...prev,
        status: 'error',
        error: getAiErrorMessage(error),
      }));
      onAiRequestFinished?.(false);
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
      }
    }
  };

  const handleToolbarAction = (action: AnnotationAction) => {
    if (!selectedText || selectedRects.length === 0 || !selectedPage) {
      return;
    }

    const scaledRects = selectedRects.map((rect) => ({
      left: rect.left / scale,
      top: rect.top / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }));

    if (action === 'highlight') {
      onAddHighlight(selectedPage, selectedText, selectedColor, scaledRects);
      resetSelectionState(true);
      return;
    }

    if (action === 'underline') {
      onAddUnderline(selectedPage, selectedText, selectedColor, scaledRects);
      resetSelectionState(true);
      return;
    }

    if (action === 'ai_summary') {
      void runAiAction('summary');
      return;
    }

    if (action === 'ai_ask') {
      void runAiAction('ask');
    }
  };

  const handleCloseToolbar = () => {
    resetSelectionState(true);
  };

  useEffect(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiState((prev) => ({
      ...prev,
      open: false,
      status: 'idle',
      content: '',
      error: null,
      warning: null,
      question: '',
    }));
    isPointerSelectingRef.current = false;
    suppressSelectionEventsRef.current = false;
    pendingReadyPageRef.current = null;
    selectionRenderLockRef.current = false;
    if (selectionRenderUnlockTimerRef.current) {
      clearTimeout(selectionRenderUnlockTimerRef.current);
      selectionRenderUnlockTimerRef.current = null;
    }
    resetSelectionState(true);
  }, [file, scale, resetSelectionState]);

  useEffect(() => () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
  }, []);

  useEffect(() => {
    if (deleteMode) {
      isPointerSelectingRef.current = false;
      suppressSelectionEventsRef.current = false;
      pendingReadyPageRef.current = null;
      selectionRenderLockRef.current = false;
      if (selectionRenderUnlockTimerRef.current) {
        clearTimeout(selectionRenderUnlockTimerRef.current);
        selectionRenderUnlockTimerRef.current = null;
      }
      resetSelectionState(true);
    }
  }, [deleteMode, resetSelectionState]);

  return (
    <div
      ref={containerRef}
      className="archive-reader-viewport h-full w-full overflow-y-auto overflow-x-auto relative"
      style={{ scrollbarGutter: 'stable both-edges' }}
    >
      <div className="min-h-full flex flex-col items-center gap-12 px-10 py-14">
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
                className="relative archive-document-frame"
                data-page-number={pageNumber}
                ref={(node) => {
                  setPageRefs(pageNumber, { card: node });
                }}
              >
                <div
                  className="archive-document-page bg-white overflow-hidden relative"
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
                      zIndex: 3,
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

                  {isRendered && selectedPage === pageNumber && selectedRects.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
                      {selectedRects.map((rect, index) => (
                        <div
                          key={`selection-${pageNumber}-${index}`}
                          className="absolute rounded-[2px]"
                          style={{
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                            backgroundColor: 'rgba(59, 130, 246, 0.26)',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="archive-document-page-num">
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

      {aiState.open && (
        <div className="fixed z-[55] right-5 bottom-5 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-black/10 bg-black/[0.03]">
            <div className="text-xs font-semibold tracking-wide uppercase text-[var(--archive-ink-black)]">
              {aiState.title}
            </div>
            <button
              type="button"
              onClick={closeAiPanel}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-black/5 text-[var(--archive-ink-grey)]"
              title="关闭 AI 结果"
              aria-label="关闭 AI 结果"
            >
              ×
            </button>
          </div>

          <div className="px-3 py-2 max-h-[46vh] overflow-auto text-sm leading-6 text-[var(--archive-ink-black)] whitespace-pre-wrap">
            {aiState.warning && (
              <div className="mb-2 rounded-md border border-amber-300/70 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                {aiState.warning}
              </div>
            )}
            {aiState.question && (
              <div className="mb-2 text-xs text-[var(--archive-ink-grey)]">
                问题：{aiState.question}
              </div>
            )}
            {(aiState.status === 'loading' || aiState.status === 'streaming') && aiState.content.length === 0 && (
              <div className="text-[var(--archive-ink-grey)]">AI 正在思考...</div>
            )}
            {aiState.content && <div>{aiState.content}</div>}
            {aiState.error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                {aiState.error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-black/10 bg-black/[0.02]">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(aiState.content);
              }}
              className="archive-action-btn !h-8 !px-3 text-xs"
              disabled={!aiState.content}
            >
              复制结果
            </button>
            <button
              type="button"
              onClick={() => {
                if (aiState.mode === 'summary') {
                  void runAiAction('summary');
                } else {
                  void runAiAction('ask');
                }
              }}
              className="archive-action-btn archive-action-btn-primary !h-8 !px-3 text-xs"
            >
              重试
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
