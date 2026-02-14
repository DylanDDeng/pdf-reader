import { Highlighter, MousePointer2, MessageSquare, Bookmark, Check } from 'lucide-react';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../types/annotation';

export type ToolMode = 'select' | 'highlight' | 'comment' | 'bookmark';

interface HighlightToolbarProps {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  selectedColor: HighlightColor;
  onColorChange: (color: HighlightColor) => void;
  showColorPicker?: boolean;
}

const TOOLS = [
  { id: 'select' as ToolMode, icon: MousePointer2, label: '选择' },
  { id: 'highlight' as ToolMode, icon: Highlighter, label: '高亮' },
  { id: 'comment' as ToolMode, icon: MessageSquare, label: '批注' },
  { id: 'bookmark' as ToolMode, icon: Bookmark, label: '书签' },
];

export function HighlightToolbar({
  mode,
  onModeChange,
  selectedColor,
  onColorChange,
  showColorPicker = true,
}: HighlightToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Tool Buttons */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 flex flex-col gap-1">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = mode === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onModeChange(tool.id)}
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

      {/* Color Picker - Only show in highlight mode */}
      {showColorPicker && mode === 'highlight' && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-2 flex flex-col gap-1.5">
          {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((colorKey) => {
            const color = HIGHLIGHT_COLORS[colorKey];
            const isSelected = selectedColor === colorKey;
            return (
              <button
                key={colorKey}
                onClick={() => onColorChange(colorKey)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  isSelected ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                }`}
                style={{ backgroundColor: color.bg }}
                title={color.name}
              >
                {isSelected && <Check className="w-4 h-4 text-slate-700" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
