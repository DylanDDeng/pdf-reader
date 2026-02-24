import { useState, useRef, useEffect } from 'react';
import { PanelLeft, MousePointer2, Highlighter, MessageSquare, Eraser, Bot, MessageCircle, ChevronDown, FileText, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReaderToolbarProps {
  scale: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  showContents: boolean;
  showAnnotations: boolean;
  eraseMode: boolean;
  showChat: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onToggleContents: () => void;
  onToggleAnnotations: () => void;
  onToggleEraseMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSummarizePage: () => void;
  onSummarizeDocument: () => void;
  onToggleChat: () => void;
  pageInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function ReaderToolbar({
  scale,
  canZoomIn,
  canZoomOut,
  showContents,
  showAnnotations,
  eraseMode,
  showChat,
  currentPage,
  totalPages,
  onPageChange,
  onToggleContents,
  onToggleAnnotations,
  onToggleEraseMode,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSummarizePage,
  onSummarizeDocument,
  onToggleChat,
  pageInputRef,
}: ReaderToolbarProps) {
  const selectActive = !eraseMode;
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);

  const handlePageLabelClick = () => {
    setPageInputValue(String(currentPage));
    setIsEditingPage(true);
  };

  useEffect(() => {
    if (isEditingPage) {
      const el = pageInputRef?.current ?? internalInputRef.current;
      el?.focus();
      el?.select();
    }
  }, [isEditingPage, pageInputRef]);

  const commitPageInput = () => {
    const parsed = parseInt(pageInputValue, 10);
    if (!isNaN(parsed) && totalPages > 0) {
      onPageChange(Math.max(1, Math.min(parsed, totalPages)));
    }
    setIsEditingPage(false);
  };

  const cancelPageInput = () => {
    setIsEditingPage(false);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  useEffect(() => {
    if (!aiMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [aiMenuOpen]);

  return (
    <header className="archive-reader-toolbar">
      <div className="archive-tool-group">
        <button
          onClick={onToggleContents}
          className={`archive-tool-btn archive-tool-btn-icon ${showContents ? 'active' : ''}`}
          title="页面缩略图（显示/隐藏）"
          aria-label="页面缩略图（显示/隐藏）"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => { if (eraseMode) onToggleEraseMode(); }}
          className={`archive-tool-btn archive-tool-btn-icon ${selectActive ? 'active' : ''}`}
          title="选择文本（拖拽文字）"
          aria-label="选择文本（拖拽文字）"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => { if (eraseMode) onToggleEraseMode(); }}
          className={`archive-tool-btn archive-tool-btn-icon ${selectActive ? 'active' : ''}`}
          title="高亮/下划线（先选中文本）"
          aria-label="高亮/下划线（先选中文本）"
        >
          <Highlighter className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleAnnotations}
          className={`archive-tool-btn archive-tool-btn-icon ${showAnnotations ? 'active' : ''}`}
          title="批注面板（显示/隐藏）"
          aria-label="批注面板（显示/隐藏）"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleEraseMode}
          className={`archive-tool-btn archive-tool-btn-icon ${eraseMode ? 'active' : ''}`}
          title="擦除标注（点击高亮删除）"
          aria-label="擦除标注（点击高亮删除）"
        >
          <Eraser className="w-4 h-4" />
        </button>

        <span className="archive-toolbar-divider" />

        <div className="relative" ref={aiMenuRef}>
          <button
            onClick={() => setAiMenuOpen((prev) => !prev)}
            className={`archive-tool-btn archive-tool-btn-icon relative ${aiMenuOpen ? 'active' : ''}`}
            title="AI 总结"
            aria-label="AI 总结"
          >
            <Bot className="w-4 h-4" />
            <ChevronDown className="absolute bottom-[3px] right-[3px] w-2 h-2 opacity-50" />
          </button>
          {aiMenuOpen && (
            <div className="archive-ai-dropdown absolute top-full left-0 mt-1.5 w-44 rounded-xl border border-black/15 bg-white shadow-xl z-50 py-1.5 px-1">
              <button
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-black/[0.06] text-[var(--archive-ink-black)] transition-colors"
                onClick={() => { setAiMenuOpen(false); onSummarizePage(); }}
              >
                <FileText className="w-4 h-4 opacity-50 shrink-0" />
                总结当前页
              </button>
              <button
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-black/[0.06] text-[var(--archive-ink-black)] transition-colors"
                onClick={() => { setAiMenuOpen(false); onSummarizeDocument(); }}
              >
                <BookOpen className="w-4 h-4 opacity-50 shrink-0" />
                总结全文
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onToggleChat}
          className={`archive-tool-btn archive-tool-btn-icon ${showChat ? 'active' : ''}`}
          title="Chat with PDF"
          aria-label="Chat with PDF"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="archive-tool-group">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="archive-tool-btn archive-tool-btn-icon"
          title="上一页"
          aria-label="上一页"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {isEditingPage ? (
          <input
            ref={(el) => {
              (internalInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
              if (pageInputRef && 'current' in pageInputRef) {
                (pageInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
              }
            }}
            type="text"
            className="archive-page-input"
            value={pageInputValue}
            onChange={(e) => setPageInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitPageInput(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelPageInput(); }
            }}
            onBlur={cancelPageInput}
          />
        ) : (
          <button
            className="archive-page-label-btn"
            onClick={handlePageLabelClick}
            title="点击跳转到指定页"
          >
            {currentPage} / {totalPages || '–'}
          </button>
        )}

        <button
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          className="archive-tool-btn archive-tool-btn-icon"
          title="下一页"
          aria-label="下一页"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <span className="archive-toolbar-divider" />
      </div>

      <div className="archive-tool-group">
        <button
          onClick={onResetZoom}
          className="archive-zoom-label"
          title="重置到 100%"
        >
          Zoom: {Math.round(scale * 100)}%
        </button>

        <button
          onClick={onZoomIn}
          disabled={!canZoomIn}
          className="archive-tool-btn archive-tool-btn-square"
          title="放大"
        >
          +
        </button>

        <button
          onClick={onZoomOut}
          disabled={!canZoomOut}
          className="archive-tool-btn archive-tool-btn-square"
          title="缩小"
        >
          -
        </button>

        <span className="archive-toolbar-divider" />

        <button className="archive-tool-btn" title="分享（开发中）">
          Share
        </button>

        <button
          onClick={() => window.print()}
          className="archive-tool-btn"
          title="打印"
        >
          Print
        </button>
      </div>
    </header>
  );
}