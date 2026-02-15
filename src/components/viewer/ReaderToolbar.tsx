import { Search, ZoomOut, ZoomIn, Maximize2, Share2, ChevronLeft, FileText } from 'lucide-react';

interface ReaderToolbarProps {
  fileName: string | null;
  scale: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onClose: () => void;
}

export function ReaderToolbar({
  fileName,
  scale,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onClose,
}: ReaderToolbarProps) {
  return (
    <header className="h-14 bg-[#f6f7f8]/90 backdrop-blur-sm border-b border-slate-200/70 flex items-center justify-between px-4 shrink-0">
      {/* Left - Back & File Name */}
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          title="返回标签页"
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
        <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={onZoomOut}
            disabled={!canZoomOut}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-l-xl transition-colors disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={onResetZoom}
            className="w-16 text-center text-sm font-semibold text-slate-700 border-x border-slate-100 hover:bg-slate-50 transition-colors h-9"
            title="重置到 100%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            disabled={!canZoomIn}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-r-xl transition-colors disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          title="搜索（开发中）"
        >
          <Search className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className="hidden lg:flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500">
          ← → 翻页
        </span>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          title="全屏（开发中）"
        >
          <Maximize2 className="w-4 h-4 text-slate-500" />
        </button>
        <button
          className="h-9 px-4 flex items-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors shadow-sm"
          title="分享（开发中）"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 ml-1" />
      </div>
    </header>
  );
}
