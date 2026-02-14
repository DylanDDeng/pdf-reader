import { Search, ZoomOut, ZoomIn, Maximize2, Share2, ChevronLeft, FileText } from 'lucide-react';

interface ReaderToolbarProps {
  fileName: string | null;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onClose: () => void;
}

export function ReaderToolbar({
  fileName,
  scale,
  onZoomIn,
  onZoomOut,
  onClose,
}: ReaderToolbarProps) {
  return (
    <header className="h-14 bg-[#f6f7f8] flex items-center justify-between px-4 shrink-0">
      {/* Left - Back & File Name */}
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-slate-700 max-w-xs truncate">
            {fileName || 'Document'}
          </span>
        </div>
      </div>

      {/* Center - Zoom Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm">
          <button
            onClick={onZoomOut}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 rounded-l-lg transition-colors"
          >
            <ZoomOut className="w-4 h-4 text-slate-500" />
          </button>
          <span className="w-14 text-center text-sm font-medium text-slate-600 border-x border-slate-100">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 rounded-r-lg transition-colors"
          >
            <ZoomIn className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
          <Search className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
          <Maximize2 className="w-4 h-4 text-slate-500" />
        </button>
        <button className="h-9 px-4 flex items-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors shadow-sm">
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 ml-1" />
      </div>
    </header>
  );
}
