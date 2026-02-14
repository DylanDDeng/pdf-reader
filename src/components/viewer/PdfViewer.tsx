import { useEffect, useRef, useCallback, useState } from 'react';
import { loadPdfDocument, renderPage } from '../../utils/pdf';

interface PdfViewerProps {
  file: File | string;
  currentPage: number;
  scale: number;
  onDocumentLoad: (totalPages: number) => void;
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
    console.log('[DEBUG] renderCurrentPage called:', {
      hasDocument: !!documentRef.current,
      hasCanvas: !!canvasRef.current,
      currentPage,
      scale,
    });

    if (!documentRef.current || !canvasRef.current) {
      console.log('[DEBUG] Skipping render - missing document or canvas');
      return;
    }

    try {
      console.log('[DEBUG] Getting page', currentPage);
      const page = await documentRef.current.getPage(currentPage);
      pageRef.current = page;
      console.log('[DEBUG] Page obtained, calling renderPage');
      await renderPage(page, canvasRef.current, scale);
      console.log('[DEBUG] renderPage completed');
    } catch (err) {
      console.error('[DEBUG] Error in renderCurrentPage:', err);
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
          console.log('[DEBUG] Loading from file path:', file);
          // Use Tauri fs plugin to read the file
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const contents = await readFile(file);
          // Convert Uint8Array to ArrayBuffer - use a new ArrayBuffer to ensure compatibility
          source = new Uint8Array(contents).buffer as ArrayBuffer;
          console.log('[DEBUG] File loaded, byteLength:', source.byteLength);
        } else {
          console.log('[DEBUG] Loading from File object');
          source = await file.arrayBuffer();
          console.log('[DEBUG] File loaded, byteLength:', source.byteLength);
        }

        console.log('[DEBUG] Calling loadPdfDocument...');
        const doc = await loadPdfDocument(source);
        console.log('[DEBUG] Document loaded, numPages:', doc.numPages);

        if (isMounted) {
          documentRef.current = doc;
          onDocumentLoad(doc.numPages);

          if (canvasRef.current) {
            console.log('[DEBUG] Rendering first page after document load...');
            const page = await doc.getPage(1);
            await renderPage(page, canvasRef.current, scale);
          }
        }
      } catch (err) {
        console.error('[DEBUG] Error loading PDF:', err);
        if (isMounted) {
          const errorMessage = err instanceof Error
            ? `${err.message}`
            : String(err);
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
      className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 flex items-start justify-center p-8"
    >
      {isLoading && (
        <div className="flex items-center justify-center h-full w-full">
          <div className="text-slate-500 dark:text-slate-400">Loading...</div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-full w-full">
          <div className="text-red-500 dark:text-red-400">{error}</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="shadow-xl bg-white"
        style={{
          display: isLoading || error ? 'none' : 'block'
        }}
      />
    </div>
  );
}
