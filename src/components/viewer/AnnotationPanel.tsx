import { useState } from 'react';
import { MessageSquare, Trash2, Edit3, Highlighter } from 'lucide-react';
import type { Annotation } from '../../types/annotation';
import { HIGHLIGHT_COLORS } from '../../types/annotation';

interface AnnotationPanelProps {
  annotations: Annotation[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => void;
  onUpdateComment: (id: string, comment: string) => void;
}

export function AnnotationPanel({
  annotations,
  currentPage,
  onPageChange,
  onDelete,
  onUpdateComment,
}: AnnotationPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const sortedAnnotations = [...annotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleEdit = (ann: Annotation) => {
    setEditingId(ann.id);
    setEditText(ann.comment || '');
  };

  const handleSave = (id: string) => {
    onUpdateComment(id, editText);
    setEditingId(null);
    setEditText('');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditText('');
  };

  if (sortedAnnotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Highlighter className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500 mb-1">暂无批注</p>
        <p className="text-xs text-slate-400 max-w-[200px]">
          选中文本并添加高亮，批注将显示在这里
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-4">
      <div className="space-y-3">
        {sortedAnnotations.map((ann) => {
          const color = HIGHLIGHT_COLORS[ann.color];
          const isEditing = editingId === ann.id;

          return (
            <div
              key={ann.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                currentPage === ann.page
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'
              }`}
              onClick={() => onPageChange(ann.page)}
            >
              {/* Header: Color indicator + Page */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color.border }}
                />
                <span className="text-xs text-slate-400">第 {ann.page} 页</span>
                <span className="text-xs text-slate-300">
                  {new Date(ann.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Selected Text Preview */}
              <div className="mb-2">
                <p className="text-sm text-slate-700 line-clamp-2 italic">
                  "{ann.selectedText}"
                </p>
              </div>

              {/* Comment Section */}
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    rows={3}
                    placeholder="添加批注..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                      }}
                      className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
                    >
                      取消
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave(ann.id);
                      }}
                      className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : ann.comment ? (
                <div className="bg-blue-50 rounded-lg p-2.5 mb-2">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700">{ann.comment}</p>
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                {!isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(ann);
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title={ann.comment ? '编辑批注' : '添加批注'}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(ann.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
