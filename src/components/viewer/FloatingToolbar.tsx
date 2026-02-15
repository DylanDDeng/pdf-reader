import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  MessageSquare,
  Settings,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  Highlighter,
} from 'lucide-react';

interface FloatingToolbarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  showContents: boolean;
  onToggleContents: () => void;
  showAnnotations: boolean;
  onToggleAnnotations: () => void;
}

export function FloatingToolbar({
  currentPage,
  totalPages,
  onPageChange,
  onPrevPage,
  onNextPage,
  showContents,
  onToggleContents,
  showAnnotations,
  onToggleAnnotations,
}: FloatingToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const progress = useMemo(() => {
    if (totalPages <= 0) return 0;
    return Math.min(100, Math.max(0, (currentPage / totalPages) * 100));
  }, [currentPage, totalPages]);

  const submitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const nextPage = Math.max(1, Math.min(totalPages || 1, parsed));
    onPageChange(nextPage);
    setPageInput(String(nextPage));
  };

  const tools = [
    { id: 'contents', icon: BookOpen, label: 'Contents', active: showContents, onClick: onToggleContents },
    { id: 'highlight', icon: Highlighter, label: 'Highlight', active: false, onClick: undefined },
    { id: 'bookmark', icon: Bookmark, label: 'Bookmark', active: false, onClick: undefined },
    { id: 'comments', icon: MessageSquare, label: 'Comments', active: showAnnotations, onClick: onToggleAnnotations },
  ];

  return (
    <>
      {/* Right Side Floating Toolbar */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 flex flex-col gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={tool.onClick}
                disabled={!tool.onClick}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                  tool.active
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed'
                }`}
                title={tool.label}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Right Settings */}
      <div className="absolute right-4 bottom-4 z-10">
        <button
          className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Center Page Navigation */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex flex-col gap-1.5 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 px-2 py-2 min-w-[260px]">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPrevPage}
              disabled={currentPage <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center justify-center gap-1.5 px-2 flex-1">
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ''))}
                onBlur={submitPageInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitPageInput();
                  }
                }}
                className="w-12 h-7 rounded-md border border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                aria-label="当前页码"
              />
              <span className="text-sm text-slate-400">/</span>
              <span className="text-sm text-slate-600 min-w-[1.5rem] text-center">
                {totalPages}
              </span>
              <span className="text-[11px] text-slate-400 ml-1 hidden sm:inline">
                {progress.toFixed(0)}%
              </span>
            </div>

            <button
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Reading Status Indicator */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm">
          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
            Reading
          </span>
        </div>
      </div>
    </>
  );
}
