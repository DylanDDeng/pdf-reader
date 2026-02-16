import { Highlighter, MessageSquare, Underline, X } from 'lucide-react';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../types/annotation';
import { useState, useEffect, useRef } from 'react';

export type AnnotationAction = 'highlight' | 'underline' | 'comment';

interface SelectionToolbarProps {
  position: { x: number; y: number };
  selectedColor: HighlightColor;
  onColorChange: (color: HighlightColor) => void;
  onAction: (action: AnnotationAction) => void;
  onClose: () => void;
}

export function SelectionToolbar({
  position,
  selectedColor,
  onColorChange,
  onAction,
  onClose,
}: SelectionToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 计算工具栏位置（确保不超出视口）
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const rect = toolbar.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    void window.innerHeight; // 用于触发重新计算位置的副作用

    let x = position.x;
    let y = position.y - rect.height - 10; // 默认在鼠标上方 10px

    // 边界检查：右边界
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    // 边界检查：左边界
    if (x < 10) {
      x = 10;
    }
    // 边界检查：上边界（如果上方空间不够，显示在下方）
    if (y < 10) {
      y = position.y + 20;
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 300);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleAction = (action: AnnotationAction) => {
    if (action === 'highlight' || action === 'underline') {
      onAction(action);
      onClose();
    }
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* 主工具栏 */}
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex items-center gap-1">
        {/* 高亮按钮 + 颜色选择器触发 */}
        <div className="relative">
          <button
            onClick={() => handleAction('highlight')}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="高亮"
          >
            <Highlighter className="w-4 h-4" />
          </button>
          {/* 颜色指示器（可点击展开颜色面板） */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: HIGHLIGHT_COLORS[selectedColor].border }}
            title="选择颜色"
          />
        </div>

        <div className="w-px h-5 bg-slate-200 mx-0.5" />

        {/* 下划线按钮 */}
        <button
          onClick={() => handleAction('underline')}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          title="下划线"
        >
          <Underline className="w-4 h-4" />
        </button>

        {/* 批注按钮 */}
        <button
          disabled
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 cursor-not-allowed"
          title="添加批注（暂不可用）"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-0.5" />

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          title="取消"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 颜色选择器面板 */}
      {showColorPicker && (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-2 flex gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
          {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((colorKey) => {
            const color = HIGHLIGHT_COLORS[colorKey];
            const isSelected = selectedColor === colorKey;
            return (
              <button
                key={colorKey}
                onClick={() => {
                  onColorChange(colorKey);
                  setShowColorPicker(false);
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isSelected 
                    ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' 
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color.bg }}
                title={color.name}
              >
                {isSelected && (
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color.border }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
