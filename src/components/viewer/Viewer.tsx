import { useState, useCallback, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSidebar } from './ReaderSidebar';
import { FloatingToolbar } from './FloatingToolbar';
import { PdfViewer } from './PdfViewer';
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

export function Viewer({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabUpdate,
}: ViewerProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  const fileId = activeTab?.annotationKey ?? null;
  const {
    annotations,
    addHighlight,
    deleteAnnotation,
    updateComment,
    getAllAnnotations,
  } = useAnnotations(fileId);

  useEffect(() => {
    setSelectedAnnotationId(null);
    setShowAnnotations(false);
  }, [activeTabId]);

  const handleDocumentLoad = useCallback((pages: number, pdfOutline: OutlineItem[]) => {
    setTotalPages(pages);
    setOutline(pdfOutline);

    if (activeTab && activeTab.currentPage > pages) {
      onTabUpdate(activeTab.id, { currentPage: pages });
    }
  }, [activeTab, onTabUpdate]);

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
    if (nextScale !== activeTab.scale) {
      onTabUpdate(activeTab.id, { scale: nextScale });
    }
  }, [activeTab, onTabUpdate]);

  const handleZoomOut = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const nextScale = Math.max(activeTab.scale - SCALE_STEP, MIN_SCALE);
    if (nextScale !== activeTab.scale) {
      onTabUpdate(activeTab.id, { scale: nextScale });
    }
  }, [activeTab, onTabUpdate]);

  const handleResetZoom = useCallback(() => {
    if (!activeTab) {
      return;
    }

    if (activeTab.scale !== 1) {
      onTabUpdate(activeTab.id, { scale: 1 });
    }
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

  const handleAnnotationPageChange = useCallback((page: number) => {
    handlePageChange(page);
  }, [handlePageChange]);

  const handleHighlightClick = useCallback((annotation: Annotation) => {
    setShowAnnotations(true);
    setSelectedAnnotationId(annotation.id);
    handlePageChange(annotation.page);
  }, [handlePageChange]);

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
      <div className="flex-1 flex flex-col h-screen bg-[#f6f7f8]">
        <div className="h-14 border-b border-slate-200 bg-white flex items-center px-4">
          <span className="font-medium text-slate-700">PDF Reader</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 mb-2">没有打开的文件</p>
            <p className="text-sm text-slate-400">拖拽 PDF 文件到窗口，或点击打开文件</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#f6f7f8]">
      <div className="bg-white border-b border-slate-200 flex items-center overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 min-w-[120px] max-w-[200px] 
                border-r border-slate-200 cursor-pointer select-none
                transition-colors group relative
                ${isActive 
                  ? 'bg-white text-slate-800' 
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }
              `}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}

              <FileText className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate flex-1">{tab.fileName}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className={`
                  w-5 h-5 rounded flex items-center justify-center
                  opacity-0 group-hover:opacity-100 transition-opacity
                  ${isActive ? 'hover:bg-slate-200' : 'hover:bg-slate-200'}
                `}
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
            fileName={activeTab.fileName}
            scale={activeTab.scale}
            canZoomIn={activeTab.scale < MAX_SCALE}
            canZoomOut={activeTab.scale > MIN_SCALE}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onClose={() => onTabClose(activeTab.id)}
          />

          <div className="flex-1 flex overflow-hidden">
            {isSidebarOpen && (
              <ReaderSidebar
                outline={outline}
                currentPage={activeTab.currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}

            <div className="flex-1 relative">
              <PdfViewer
                file={activeTab.file}
                currentPage={activeTab.currentPage}
                scale={activeTab.scale}
                annotations={annotations}
                onDocumentLoad={handleDocumentLoad}
                onAddHighlight={handleAddHighlight}
                onHighlightClick={handleHighlightClick}
                interactiveHighlights={showAnnotations}
              />

              <FloatingToolbar
                currentPage={activeTab.currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onPrevPage={handlePrevPage}
                onNextPage={handleNextPage}
                showAnnotations={showAnnotations}
                onToggleAnnotations={() => setShowAnnotations((prev) => !prev)}
                showContents={isSidebarOpen}
                onToggleContents={() => setIsSidebarOpen((prev) => !prev)}
              />
            </div>

            {showAnnotations && (
              <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h3 className="font-medium text-slate-800">批注</h3>
                </div>
                <AnnotationPanel
                  annotations={getAllAnnotations()}
                  currentPage={activeTab.currentPage}
                  onPageChange={handleAnnotationPageChange}
                  onDelete={handleDeleteAnnotation}
                  onUpdateComment={updateComment}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
