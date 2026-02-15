import type { OutlineItem } from '../../utils/pdf';

interface ReaderSidebarProps {
  fileName: string | null;
  outline: OutlineItem[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onBack: () => void;
}

function stripPdfExt(name: string | null): string {
  if (!name) return 'Document';
  return name.replace(/\.pdf$/i, '');
}

export function ReaderSidebar({
  fileName,
  outline,
  currentPage,
  totalPages,
  onPageChange,
  onBack,
}: ReaderSidebarProps) {
  const cleanName = stripPdfExt(fileName);
  const subtitle = outline.find((item) => item.level === 0)?.title || 'Reading Document';

  const resolvePageLabel = (page: number): string => {
    const hit = outline.find((item) => item.page === page);
    if (!hit) {
      return `Page ${String(page).padStart(2, '0')} — Reading`;
    }
    return `Page ${String(page).padStart(2, '0')} — ${hit.title}`;
  };

  return (
    <aside className="archive-reader-sidebar">
      <button onClick={onBack} className="archive-reader-brand" title="返回库视图">
        <span className="archive-reader-brand-icon" />
        <span>ARCHIVE.PDF / BACK</span>
      </button>

      <div className="archive-doc-nav-header">
        <span className="archive-caps text-[var(--archive-ink-grey)]" title={cleanName}>
          {cleanName}
        </span>
        <div className="archive-doc-nav-subtitle" title={subtitle}>
          {subtitle}
        </div>
      </div>

      <div className="archive-page-thumb-list">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          const active = currentPage === pageNum;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`archive-page-thumb ${active ? 'active' : ''}`}
            >
              <div className="archive-page-thumb-content" />
              <span className="archive-page-label archive-caps" title={resolvePageLabel(pageNum)}>
                {resolvePageLabel(pageNum)}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
