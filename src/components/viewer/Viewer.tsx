import { useState, useCallback, useRef, useEffect } from 'react';
import { ViewerToolbar } from './ViewerToolbar';
import { PdfViewer } from './PdfViewer';

interface ViewerProps {
  file: File | null;
  filePath: string | null;
  onClose: () => void;
}

export function Viewer({ file, filePath, onClose }: ViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDocumentLoad = useCallback((pages: number) => {
    setTotalPages(pages);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 4.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleFitWidth = useCallback(() => {
    if (containerRef.current) {
      // Calculate scale based on container width
      const containerWidth = containerRef.current.clientWidth;
      // Assuming a standard PDF width of 612 points (US Letter)
      const pdfWidth = 612;
      const newScale = (containerWidth - 80) / pdfWidth;
      setScale(Math.max(0.25, Math.min(newScale, 4.0)));
    }
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  if (!file && !filePath) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col" ref={containerRef}>
      <ViewerToolbar
        fileName={file?.name || (filePath ? filePath.split('/').pop() || null : null)}
        currentPage={currentPage}
        totalPages={totalPages}
        scale={scale}
        onGoToPage={handlePageChange}
        onPrevPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitWidth={handleFitWidth}
        onClose={onClose}
      />
      <PdfViewer
        file={file || filePath as string}
        currentPage={currentPage}
        scale={scale}
        onDocumentLoad={handleDocumentLoad}
      />
    </div>
  );
}
