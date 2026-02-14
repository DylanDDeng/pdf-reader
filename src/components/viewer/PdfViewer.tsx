import { useEffect, useRef, useCallback, useState } from 'react';
import { loadPdfDocument, renderPage, extractOutline, type OutlineItem } from '../../utils/pdf';

interface PdfViewerProps {
  file: File | string;
  currentPage: number;
  scale: number;
  onDocumentLoad: (totalPages: number, outline: OutlineItem[]) => void;
}

export function PdfViewer({
  file,
  currentPage,
  scale,
  onDocumentLoad,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<any>(null);
  const documentRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const renderCurrentPage = useCallback(async () => {
    if (!documentRef.current || !canvasRef.current) {
      return;
    }

    try {
      const page = await documentRef.current.getPage(currentPage);
      pageRef.current = page;
      await renderPage(page, canvasRef.current, scale);
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }, [currentPage, scale]);

  // Load document
  useEffect(() => {
    let isMounted = true;

    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
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

          if (canvasRef.current) {
            const page = await doc.getPage(1);
            await renderPage(page, canvasRef.current, scale);
          }
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(`Failed to load PDF: ${errorMessage}`);
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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#eef0f2] relative flex justify-center p-8"
    >
      {/* PDF Page Container */}
      <div className="relative">
        {/* Page Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center w-[612px] h-[792px]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-slate-400">Loading...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center w-[612px] h-[792px] p-8">
              <div className="text-red-500 text-center">
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="block"
            style={{
              display: isLoading || error ? 'none' : 'block',
            }}
          />
        </div>

        {/* Page Number Indicator - Top Right */}
        <div className="absolute -top-6 right-0 text-xs text-slate-400 font-medium">
          {currentPage.toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
