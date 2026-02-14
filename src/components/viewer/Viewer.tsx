import { useState, useCallback, useRef, useEffect } from 'react';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSidebar } from './ReaderSidebar';
import { FloatingToolbar } from './FloatingToolbar';
import { PdfViewer } from './PdfViewer';
import type { OutlineItem } from '../../utils/pdf';

interface ViewerProps {
  file: File | null;
  filePath: string | null;
  onClose: () => void;
}

export function Viewer({ file, filePath, onClose }: ViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDocumentLoad = useCallback((pages: number, pdfOutline: OutlineItem[]) => {
    setTotalPages(pages);
    setCurrentPage(1);
    setOutline(pdfOutline);
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

  const handlePrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

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

  const fileName = file?.name || (filePath ? filePath.split('/').pop() || 'Document' : 'Document');

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#f6f7f8]" ref={containerRef}>
      {/* Top Toolbar */}
      <ReaderToolbar
        fileName={fileName}
        scale={scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onClose={onClose}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Outline */}
        <ReaderSidebar
          outline={outline}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />

        {/* Center - PDF Viewer with Floating Tools */}
        <div className="flex-1 relative">
          <PdfViewer
            file={file || (filePath as string)}
            currentPage={currentPage}
            scale={scale}
            onDocumentLoad={handleDocumentLoad}
          />
          
          {/* Floating Toolbars */}
          <FloatingToolbar
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </div>
      </div>
    </div>
  );
}
