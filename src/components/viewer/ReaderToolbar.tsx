import { PanelLeft, MousePointer2, Highlighter, MessageSquare, Eraser } from 'lucide-react';

interface ReaderToolbarProps {
  scale: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  showContents: boolean;
  showAnnotations: boolean;
  eraseMode: boolean;
  onToggleContents: () => void;
  onToggleAnnotations: () => void;
  onToggleEraseMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function ReaderToolbar({
  scale,
  canZoomIn,
  canZoomOut,
  showContents,
  showAnnotations,
  eraseMode,
  onToggleContents,
  onToggleAnnotations,
  onToggleEraseMode,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: ReaderToolbarProps) {
  const selectActive = !eraseMode;

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
          onClick={() => {
            if (eraseMode) {
              onToggleEraseMode();
            }
          }}
          className={`archive-tool-btn archive-tool-btn-icon ${selectActive ? 'active' : ''}`}
          title="选择文本（拖拽文字）"
          aria-label="选择文本（拖拽文字）"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            if (eraseMode) {
              onToggleEraseMode();
            }
          }}
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
