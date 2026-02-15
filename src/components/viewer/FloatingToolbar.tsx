import {
  BookOpen,
  MessageSquare,
  Settings,
  Bookmark,
  Highlighter,
  Eraser,
} from 'lucide-react';

interface FloatingToolbarProps {
  showContents: boolean;
  onToggleContents: () => void;
  showAnnotations: boolean;
  onToggleAnnotations: () => void;
  eraseMode: boolean;
  onToggleEraseMode: () => void;
}

export function FloatingToolbar({
  showContents,
  onToggleContents,
  showAnnotations,
  onToggleAnnotations,
  eraseMode,
  onToggleEraseMode,
}: FloatingToolbarProps) {
  const tools = [
    { id: 'contents', icon: BookOpen, label: 'Contents', active: showContents, onClick: onToggleContents },
    { id: 'highlight', icon: Highlighter, label: 'Highlight', active: false, onClick: undefined },
    { id: 'eraser', icon: Eraser, label: 'Erase Highlight', active: eraseMode, onClick: onToggleEraseMode },
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

      {/* Reading Status Indicator */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm">
          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
            {eraseMode ? 'Erase Mode' : 'Reading'}
          </span>
        </div>
      </div>
    </>
  );
}
