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
          className={`archive-tool-btn ${showContents ? 'active' : ''}`}
          title="显示/隐藏页面侧栏"
        >
          Pages
        </button>

        <button
          onClick={() => {
            if (eraseMode) {
              onToggleEraseMode();
            }
          }}
          className={`archive-tool-btn ${selectActive ? 'active' : ''}`}
          title="选择文本"
        >
          Select
        </button>

        <button
          onClick={() => {
            if (eraseMode) {
              onToggleEraseMode();
            }
          }}
          className="archive-tool-btn"
          title="高亮模式"
        >
          Highlight
        </button>

        <button
          onClick={onToggleAnnotations}
          className={`archive-tool-btn ${showAnnotations ? 'active' : ''}`}
          title="显示/隐藏批注面板"
        >
          Note
        </button>

        <button
          onClick={onToggleEraseMode}
          className={`archive-tool-btn ${eraseMode ? 'active' : ''}`}
          title="擦除高亮"
        >
          Draw
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
