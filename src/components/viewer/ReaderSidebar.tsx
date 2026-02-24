import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { loadPdfDocument } from '../../utils/pdf';
import type { OutlineItem } from '../../utils/pdf';
import { OutlineTree } from './OutlineTree';

interface ReaderSidebarProps {
  file: File | string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onBack: () => void;
  sidebarTab: 'thumbnails' | 'outline';
  onSidebarTabChange: (tab: 'thumbnails' | 'outline') => void;
  outline: OutlineItem[];
}

export function ReaderSidebar({
  file,
  currentPage,
  totalPages,
  onPageChange,
  onBack,
  sidebarTab,
  onSidebarTabChange,
  outline,
}: ReaderSidebarProps) {
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderSeqRef = useRef(0);
  const activeThumbRenderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null);
  const [renderedThumbs, setRenderedThumbs] = useState<Record<number, boolean>>({});

  const resolvePageLabel = (page: number): string => {
    return `Page ${String(page).padStart(2, '0')}`;
  };

  const setCanvasRef = useCallback((pageNum: number, node: HTMLCanvasElement | null) => {
    if (!node) {
      canvasRefs.current.delete(pageNum);
      return;
    }
    canvasRefs.current.set(pageNum, node);
  }, []);

  const renderThumbPage = useCallback(async (page: PDFPageProxy, canvas: HTMLCanvasElement) => {
    const baseViewport = page.getViewport({ scale: 1 });
    const containerWidth = Math.max(canvas.parentElement?.clientWidth ?? 200, 120);
    const scale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(viewport.width * outputScale));
    const height = Math.max(1, Math.floor(viewport.height * outputScale));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const transform = outputScale !== 1
      ? [outputScale, 0, 0, outputScale, 0, 0]
      : undefined;

    const renderTask = page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform,
    });
    activeThumbRenderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
    } finally {
      if (activeThumbRenderTaskRef.current === renderTask) {
        activeThumbRenderTaskRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    const seq = ++renderSeqRef.current;
    setRenderedThumbs({});

    const loadAndRenderThumbnails = async () => {
      if (!file || totalPages === 0) {
        return;
      }

      try {
        let source: ArrayBuffer;
        if (typeof file === 'string') {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const contents = await readFile(file);
          source = new Uint8Array(contents).buffer as ArrayBuffer;
        } else {
          source = await file.arrayBuffer();
        }

        if (cancelled || seq !== renderSeqRef.current) {
          return;
        }

        doc = await loadPdfDocument(source);
        const pageLimit = Math.min(totalPages, doc.numPages);

        const renderSingleThumb = async (pageNum: number) => {
          if (cancelled || seq !== renderSeqRef.current) {
            return;
          }

          let canvas = canvasRefs.current.get(pageNum) ?? null;
          if (!canvas) {
            for (let wait = 0; wait < 15; wait += 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 16));
              if (cancelled || seq !== renderSeqRef.current) {
                return;
              }
              canvas = canvasRefs.current.get(pageNum) ?? null;
              if (canvas) break;
            }
          }

          if (!canvas) {
            return;
          }

          if (!doc) {
            return;
          }
          const page = await doc.getPage(pageNum);
          if (cancelled || seq !== renderSeqRef.current) {
            return;
          }

          await renderThumbPage(page, canvas);
          if (cancelled || seq !== renderSeqRef.current) {
            return;
          }

          setRenderedThumbs((prev) => (prev[pageNum] ? prev : { ...prev, [pageNum]: true }));
        };

        const priorityPages = [currentPage, currentPage - 1, currentPage + 1, 1]
          .filter((pageNum) => Number.isFinite(pageNum) && pageNum >= 1 && pageNum <= pageLimit);
        const prioritySet = new Set<number>();

        for (const pageNum of priorityPages) {
          if (prioritySet.has(pageNum)) {
            continue;
          }
          prioritySet.add(pageNum);
          await renderSingleThumb(pageNum);
          if (cancelled || seq !== renderSeqRef.current) {
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }

        for (let pageNum = 1; pageNum <= pageLimit; pageNum += 1) {
          if (prioritySet.has(pageNum)) {
            continue;
          }
          await renderSingleThumb(pageNum);
          if (cancelled || seq !== renderSeqRef.current) {
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to render sidebar thumbnails:', err);
        }
      } finally {
        if (doc) {
          doc.destroy();
        }
      }
    };

    void loadAndRenderThumbnails();

    return () => {
      cancelled = true;
      if (activeThumbRenderTaskRef.current) {
        activeThumbRenderTaskRef.current.cancel();
        activeThumbRenderTaskRef.current = null;
      }
    };
  }, [file, renderThumbPage, totalPages]);

  return (
    <aside className="archive-reader-sidebar">
      <button onClick={onBack} className="archive-reader-brand" title="返回库视图">
        <span className="archive-reader-brand-icon" />
        <span>DocFlow / Back</span>
      </button>

      <div className="archive-sidebar-tabs">
        <button
          className={`archive-sidebar-tab ${sidebarTab === 'thumbnails' ? 'is-active' : ''}`}
          onClick={() => onSidebarTabChange('thumbnails')}
        >
          缩略图
        </button>
        <button
          className={`archive-sidebar-tab ${sidebarTab === 'outline' ? 'is-active' : ''}`}
          onClick={() => onSidebarTabChange('outline')}
        >
          目录
        </button>
      </div>

      <div className="archive-page-thumb-list" style={{ display: sidebarTab === 'thumbnails' ? undefined : 'none' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const active = currentPage === pageNum;
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`archive-page-thumb ${active ? 'active' : ''}`}
              >
                <div className="archive-page-thumb-stage">
                  <canvas
                    ref={(node) => setCanvasRef(pageNum, node)}
                    className={`archive-page-thumb-canvas ${renderedThumbs[pageNum] ? 'is-ready' : ''}`}
                  />
                  {!renderedThumbs[pageNum] && (
                    <div className="archive-page-thumb-content" />
                  )}
                </div>
                <span className="archive-page-label archive-caps" title={resolvePageLabel(pageNum)}>
                  {resolvePageLabel(pageNum)}
                </span>
              </button>
            );
          })}
        </div>
      {sidebarTab === 'outline' && (
        <OutlineTree
          outline={outline}
          currentPage={currentPage}
          onPageChange={onPageChange}
        />
      )}
    </aside>
  );
}
