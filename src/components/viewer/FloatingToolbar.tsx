import { useState } from 'react';
import {
  BookOpen,
  Pencil,
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
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function FloatingToolbar({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: FloatingToolbarProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const tools = [
    { id: 'contents', icon: BookOpen, label: 'Contents' },
    { id: 'annotate', icon: Pencil, label: 'Annotate' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight' },
    { id: 'bookmark', icon: Bookmark, label: 'Bookmark' },
    { id: 'comments', icon: MessageSquare, label: 'Comments' },
  ];

  return (
    <>
      {/* Right Side Floating Toolbar */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 flex flex-col gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(isActive ? null : tool.id)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
        <div className="flex items-center gap-2 bg-white rounded-full shadow-lg border border-slate-200 px-1 py-1">
          <button
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-sm font-medium text-slate-700 min-w-[1.5rem] text-center">
              {currentPage}
            </span>
            <span className="text-sm text-slate-400">of</span>
            <span className="text-sm text-slate-500 min-w-[1.5rem] text-center">
              {totalPages}
            </span>
          </div>
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
