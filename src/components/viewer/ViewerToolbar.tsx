import { FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ViewerToolbarProps {
  fileName: string | null;
  currentPage: number;
  totalPages: number;
  scale: number;
  onGoToPage: (page: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onClose: () => void;
}

export function ViewerToolbar({
  fileName,
  currentPage,
  totalPages,
  scale,
  onGoToPage,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onClose,
}: ViewerToolbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 bg-white dark:bg-background-dark border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
      {/* Left - File Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          <span className="font-medium text-slate-800 dark:text-white truncate max-w-xs">
            {fileName || 'Document'}
          </span>
        </div>
      </div>

      {/* Center - Page Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="number"
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value, 10);
              if (!isNaN(page) && page >= 1 && page <= totalPages) {
                onGoToPage(page);
              }
            }}
            className="w-12 px-2 py-1 text-center bg-slate-100 dark:bg-slate-800 border border-transparent rounded focus:outline-none focus:border-primary"
            min={1}
            max={totalPages}
          />
          <span>/</span>
          <span>{totalPages}</span>
        </div>
        <button
          onClick={onNextPage}
          disabled={currentPage >= totalPages}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Right - Zoom & Theme */}
      <div className="flex items-center gap-2">
        <button
          onClick={onZoomOut}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ZoomOut className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-400 w-14 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          onClick={onFitWidth}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Fit Width"
        >
          <Maximize className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />

        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          )}
        </button>
      </div>
    </header>
  );
}
