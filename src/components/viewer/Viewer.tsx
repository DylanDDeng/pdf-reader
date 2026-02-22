import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, FileText, ChevronRight } from 'lucide-react';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSidebar } from './ReaderSidebar';
import { PdfViewer, type AnnotationClickContext } from './PdfViewer';
import { AnnotationPanel } from './AnnotationPanel';
import type { OutlineItem } from '../../utils/pdf';
import type { Tab } from '../../hooks/useTabs';
import type { Annotation, HighlightColor } from '../../types/annotation';
import { useAnnotations } from '../../hooks/useAnnotations';

interface ViewerProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabUpdate: (
    tabId: string,
    updates: Partial<Omit<Tab, 'id' | 'file' | 'fileName' | 'annotationKey'>>
  ) => void;
}

const SCALE_STEP = 0.25;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

interface FocusGuideState {
  source: { x: number; y: number };
  target: { x: number; y: number };
}

export function Viewer({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabUpdate,
}: ViewerProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [focusOrigin, setFocusOrigin] = useState<{ x: number; y: number } | null>(null);
  const [focusGuide, setFocusGuide] = useState<FocusGuideState | null>(null);
  const [panelAttention, setPanelAttention] = useState(false);
  const [attentionAnnotationId, setAttentionAnnotationId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1920, height: 1080 });

  const annotationPanelRef = useRef<HTMLDivElement | null>(null);
  const focusGuideSeqRef = useRef(0);
  const focusGuideRafRef = useRef<number | null>(null);
  const focusGuideTimerRefs = useRef<number[]>([]);
  const previousTabCountRef = useRef(tabs.length);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  const fileId = activeTab?.annotationKey ?? null;
  const {
    annotations,
    addHighlight,
    addUnderline,
    deleteAnnotation,
    updateComment,
    getAllAnnotations,
  } = useAnnotations(fileId);

  const clearFocusGuideAnimation = useCallback(() => {
    if (focusGuideRafRef.current !== null) {
      cancelAnimationFrame(focusGuideRafRef.current);
      focusGuideRafRef.current = null;
    }
    focusGuideTimerRefs.current.forEach((timerId) => {
      clearTimeout(timerId);
    });
    focusGuideTimerRefs.current = [];
    setFocusOrigin(null);
    setFocusGuide(null);
    setPanelAttention(false);
    setAttentionAnnotationId(null);
  }, []);

  const triggerAnnotationFocusGuide = useCallback((annotationId: string, context?: AnnotationClickContext) => {
    if (!context) {
      return;
    }

    clearFocusGuideAnimation();
    const seq = ++focusGuideSeqRef.current;
    const source = { x: context.clientX, y: context.clientY };
    setFocusOrigin(source);
    setPanelAttention(true);
    setAttentionAnnotationId(annotationId);

    const hideOriginTimer = window.setTimeout(() => {
      if (focusGuideSeqRef.current !== seq) {
        return;
      }
      setFocusOrigin(null);
    }, 520);
    focusGuideTimerRefs.current.push(hideOriginTimer);

    let attempts = 0;
    const maxAttempts = 70;

    const resolveTarget = () => {
      if (focusGuideSeqRef.current !== seq) {
        return;
      }

      const card = annotationPanelRef.current?.querySelector<HTMLDivElement>(
        `[data-annotation-id="${annotationId}"]`
      );

      if (!card) {
        attempts += 1;
        if (attempts <= maxAttempts) {
          focusGuideRafRef.current = requestAnimationFrame(resolveTarget);
        }
        return;
      }

      card.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const trackingStart = performance.now();
      const trackingDuration = 760;

      const trackTarget = () => {
        if (focusGuideSeqRef.current !== seq) {
          return;
        }

        const rect = card.getBoundingClientRect();
        setFocusGuide({
          source,
          target: {
            x: rect.left + Math.min(36, Math.max(20, rect.width * 0.18)),
            y: rect.top + rect.height / 2,
          },
        });

        if (performance.now() - trackingStart < trackingDuration) {
          focusGuideRafRef.current = requestAnimationFrame(trackTarget);
        }
      };

      trackTarget();
    };

    focusGuideRafRef.current = requestAnimationFrame(resolveTarget);

    const finishTimer = window.setTimeout(() => {
      if (focusGuideSeqRef.current !== seq) {
        return;
      }
      setFocusOrigin(null);
      setFocusGuide(null);
      setPanelAttention(false);
      setAttentionAnnotationId(null);
    }, 1750);
    focusGuideTimerRefs.current.push(finishTimer);
  }, [clearFocusGuideAnimation]);

  const focusGuidePath = useMemo(() => {
    if (!focusGuide) {
      return '';
    }
    const { source, target } = focusGuide;
    const deltaX = target.x - source.x;
    const curveSpan = Math.max(120, Math.abs(deltaX) * 0.34);
    const c1x = source.x + curveSpan;
    const c2x = target.x - curveSpan;
    const c1y = source.y;
    const c2y = target.y;
    return `M ${source.x} ${source.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`;
  }, [focusGuide]);

  useEffect(() => {
    clearFocusGuideAnimation();
    setSelectedAnnotationId(null);
    setShowAnnotations(false);
    setEraseMode(false);
  }, [activeTabId, clearFocusGuideAnimation]);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => {
      window.removeEventListener('resize', updateViewportSize);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearFocusGuideAnimation();
    };
  }, [clearFocusGuideAnimation]);

  useEffect(() => {
    if (tabs.length > previousTabCountRef.current) {
      setIsSidebarOpen(false);
    }
    previousTabCountRef.current = tabs.length;
  }, [tabs.length]);

  const handleDocumentLoad = useCallback((pages: number, pdfOutline: OutlineItem[]) => {
    setTotalPages(pages);
    setOutline(pdfOutline);

    if (!activeTabId) {
      return;
    }

    const current = tabs.find((tab) => tab.id === activeTabId)?.currentPage ?? 1;
    if (current > pages) {
      onTabUpdate(activeTabId, { currentPage: pages });
    }
  }, [activeTabId, onTabUpdate, tabs]);

  const handlePageChange = useCallback((page: number) => {
    if (!activeTab) {
      return;
    }

    const pageLimit = totalPages > 0 ? totalPages : 1;
    const nextPage = Math.max(1, Math.min(page, pageLimit));

    if (nextPage !== activeTab.currentPage) {
      onTabUpdate(activeTab.id, { currentPage: nextPage });
    }
  }, [activeTab, onTabUpdate, totalPages]);

  const handlePrevPage = useCallback(() => {
    if (!activeTab) {
      return;
    }

    handlePageChange(activeTab.currentPage - 1);
  }, [activeTab, handlePageChange]);

  const handleNextPage = useCallback(() => {
    if (!activeTab) {
      return;
    }

    handlePageChange(activeTab.currentPage + 1);
  }, [activeTab, handlePageChange]);

  const handleZoomIn = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const nextScale = Math.min(activeTab.scale + SCALE_STEP, MAX_SCALE);
    if (activeTab.zoomMode === 'fit_width') {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
      return;
    }

    if (nextScale !== activeTab.scale) {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
    }
  }, [activeTab, onTabUpdate]);

  const handleZoomOut = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const nextScale = Math.max(activeTab.scale - SCALE_STEP, MIN_SCALE);
    if (activeTab.zoomMode === 'fit_width') {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
      return;
    }

    if (nextScale !== activeTab.scale) {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
    }
  }, [activeTab, onTabUpdate]);

  const handleResetZoom = useCallback(() => {
    if (!activeTab) {
      return;
    }

    if (activeTab.zoomMode !== 'custom' || activeTab.scale !== 1) {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: 1 });
    }
  }, [activeTab, onTabUpdate]);

  const handleFitWidthScaleCalculated = useCallback((nextScale: number) => {
    if (!activeTab || activeTab.zoomMode !== 'fit_width') {
      return;
    }
    if (Math.abs(nextScale - activeTab.scale) <= 0.01) {
      return;
    }

    onTabUpdate(activeTab.id, { scale: nextScale });
  }, [activeTab, onTabUpdate]);

  const handleAddHighlight = useCallback((
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => {
    const annotation = addHighlight(page, selectedText, color, rects);
    setShowAnnotations(true);
    setSelectedAnnotationId(annotation.id);
  }, [addHighlight]);

  const handleAddUnderline = useCallback((
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => {
    const annotation = addUnderline(page, selectedText, color, rects);
    setShowAnnotations(true);
    setSelectedAnnotationId(annotation.id);
  }, [addUnderline]);

  const handleAnnotationPageChange = useCallback((page: number) => {
    handlePageChange(page);
  }, [handlePageChange]);

  const handleHighlightClick = useCallback((annotation: Annotation, context?: AnnotationClickContext) => {
    if (eraseMode) {
      deleteAnnotation(annotation.id);
      if (selectedAnnotationId === annotation.id) {
        setSelectedAnnotationId(null);
      }
      return;
    }
    setShowAnnotations(true);
    setSelectedAnnotationId(annotation.id);
    handlePageChange(annotation.page);
    triggerAnnotationFocusGuide(annotation.id, context);
  }, [deleteAnnotation, eraseMode, handlePageChange, selectedAnnotationId, triggerAnnotationFocusGuide]);

  const handleDeleteAnnotation = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId);
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(null);
    }
  }, [deleteAnnotation, selectedAnnotationId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTab) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut, handleResetZoom]);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 archive-shell-bg archive-library">
        <div className="h-14 border-b border-black/10 border-dashed bg-white/40 flex items-center px-4">
          <span className="font-medium text-[var(--archive-ink-black)]">PDF Reader</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-white rounded-full border border-black/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[var(--archive-ink-grey)]" />
            </div>
            <p className="text-[var(--archive-ink-black)] mb-2">没有打开的文件</p>
            <p className="text-sm text-[var(--archive-ink-grey)]">拖拽 PDF 文件到窗口，或点击打开文件</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 archive-shell-bg archive-library">
      <div className="bg-white/45 border-b border-black/10 border-dashed flex items-center overflow-x-auto backdrop-blur-[1px]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 min-w-[120px] max-w-[220px]
                border-r border-black/10 cursor-pointer select-none
                transition-colors group relative
                ${isActive
                  ? 'bg-white/80 text-[var(--archive-ink-black)]'
                  : 'bg-transparent text-[var(--archive-ink-grey)] hover:bg-white/35'}
              `}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--archive-rust)]" />
              )}

              <FileText className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate flex-1">{tab.fileName}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {activeTab && (
        <>
          <ReaderToolbar
            scale={activeTab.scale}
            canZoomIn={activeTab.scale < MAX_SCALE}
            canZoomOut={activeTab.scale > MIN_SCALE}
            showContents={isSidebarOpen}
            showAnnotations={showAnnotations}
            eraseMode={eraseMode}
            onToggleContents={() => setIsSidebarOpen((prev) => !prev)}
            onToggleAnnotations={() => setShowAnnotations((prev) => !prev)}
            onToggleEraseMode={() => setEraseMode((prev) => !prev)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
          />

          <div className="flex-1 flex overflow-hidden min-h-0">
            {isSidebarOpen && (
              <ReaderSidebar
                file={activeTab.file}
                fileName={activeTab.fileName}
                outline={outline}
                currentPage={activeTab.currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onBack={() => onTabClose(activeTab.id)}
              />
            )}

            <div className="flex-1 relative min-h-0 min-w-0">
              <PdfViewer
                file={activeTab.file}
                currentPage={activeTab.currentPage}
                scale={activeTab.scale}
                fitWidthMode={activeTab.zoomMode === 'fit_width'}
                onFitWidthScaleCalculated={handleFitWidthScaleCalculated}
                annotations={annotations}
                onDocumentLoad={handleDocumentLoad}
                onPageChange={handlePageChange}
                onAddHighlight={handleAddHighlight}
                onAddUnderline={handleAddUnderline}
                onHighlightClick={handleHighlightClick}
                interactiveHighlights={false}
                deleteMode={eraseMode}
              />
            </div>

            {showAnnotations && (
              <div
                ref={annotationPanelRef}
                className={`w-80 bg-white/85 border-l border-black/10 border-dashed flex flex-col backdrop-blur-[1px] ${
                  panelAttention ? 'archive-annotation-panel-guided' : ''
                }`}
              >
                <div className="px-4 py-3 border-b border-black/10 border-dashed flex items-center justify-between gap-2">
                  <h3 className="font-medium text-[var(--archive-ink-black)] uppercase tracking-[0.06em] text-xs">批注</h3>
                  <button
                    type="button"
                    onClick={() => setShowAnnotations(false)}
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-black/10 text-[var(--archive-ink-grey)] transition-colors hover:bg-white hover:text-[var(--archive-ink-black)]"
                    title="收起批注面板"
                    aria-label="收起批注面板"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <AnnotationPanel
                  annotations={getAllAnnotations()}
                  currentPage={activeTab.currentPage}
                  onPageChange={handleAnnotationPageChange}
                  onDelete={handleDeleteAnnotation}
                  onUpdateComment={updateComment}
                  selectedAnnotationId={selectedAnnotationId}
                  attentionAnnotationId={attentionAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                />
              </div>
            )}
          </div>

          {(focusGuide || focusOrigin) && (
            <div className="archive-focus-overlay" aria-hidden>
              {focusOrigin && (
                <span
                  className="archive-focus-origin-pulse"
                  style={{ left: focusOrigin.x, top: focusOrigin.y }}
                />
              )}
              <svg
                className="archive-focus-svg"
                viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
                preserveAspectRatio="none"
              >
                {focusGuide && focusGuidePath && (
                  <>
                    <path d={focusGuidePath} pathLength={1} className="archive-focus-bridge-line" />
                    <circle
                      className="archive-focus-target-dot"
                      cx={focusGuide.target.x}
                      cy={focusGuide.target.y}
                      r={7}
                    />
                  </>
                )}
              </svg>
            </div>
          )}
        </>
      )}
    </div>
  );
}
