import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Grid, List, FolderPlus, Upload } from 'lucide-react';
import { FileCard } from './FileCard';
import { ImportModal } from './ImportModal';
import { ImportProgress } from './ImportProgress';
import { ImportResult } from './ImportResult';
import type { LibraryItem, ImportResult as ImportResultType, ImportProgress as ImportProgressType, ScannedFile } from '../../types/library';

interface LibraryViewProps {
  onOpenRecentFile: (path: string) => void;
  onOpenFile?: (file: File | string) => void;
  items: LibraryItem[];
  onImportFiles: (files: ScannedFile[]) => Promise<ImportResultType>;
  onToggleFavorite: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRenameItem: (itemId: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  importProgress: ImportProgressType | null;
  lastSyncResult?: { removedCount: number } | null;
  triggerImport?: number;
}

export function LibraryView({
  onOpenRecentFile,
  onOpenFile,
  items,
  onImportFiles,
  onToggleFavorite,
  onRemoveItem,
  onRenameItem,
  importProgress,
  lastSyncResult,
  triggerImport,
}: LibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResultType | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const prevTriggerImportRef = useRef(triggerImport);

  useEffect(() => {
    if (triggerImport !== prevTriggerImportRef.current && triggerImport && triggerImport > 0) {
      setShowImportModal(true);
    }
    prevTriggerImportRef.current = triggerImport;
  }, [triggerImport]);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.path.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFavorites = !showFavorites || Boolean(item.favorite);

    return matchesSearch && matchesFavorites;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime();
  });

  const favoritesCount = items.filter((item) => item.favorite).length;

  const handleImport = useCallback(
    async (files: ScannedFile[]) => {
      setIsImporting(true);
      try {
        const result = await onImportFiles(files);
        setImportResult(result);
      } catch (error) {
        console.error('Import error:', error);
      } finally {
        setIsImporting(false);
      }
    },
    [onImportFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (files.length > 0 && onOpenFile) {
      onOpenFile(files[0]);
    }
  }, [onOpenFile]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    return date.toLocaleDateString();
  };

  return (
    <div
      className="archive-library h-full min-h-0 min-w-0 overflow-hidden flex flex-col relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[rgba(59,130,196,0.08)] border-4 border-dashed border-[var(--archive-blue)]">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-black/10">
            <Upload className="w-12 h-12 text-[var(--archive-blue)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--archive-ink-black)] mb-2">Drop to open PDF</h3>
            <p className="text-[var(--archive-ink-grey)]">将文件拖放到这里，立即开始阅读</p>
          </div>
        </div>
      )}

      <header className="archive-top-bar">
        <div className="archive-search-container">
          <Search className="archive-search-icon" />
          <input
            type="text"
            placeholder="Search archive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="archive-search-input"
          />
        </div>

        <div className="archive-view-controls">
          <button
            onClick={() => setViewMode('grid')}
            className={`archive-btn-text ${viewMode === 'grid' ? 'archive-btn-primary' : ''}`}
          >
            <Grid className="w-3.5 h-3.5" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`archive-btn-text ${viewMode === 'list' ? 'archive-btn-primary' : ''}`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
          <button
            onClick={() => setShowFavorites((prev) => !prev)}
            className={`archive-btn-text ${showFavorites ? 'archive-btn-primary' : ''}`}
          >
            Filter +
          </button>
        </div>
      </header>

      <main className="archive-content-scroll">
        {lastSyncResult && lastSyncResult.removedCount > 0 && (
          <div className="mb-6 rounded-lg border border-[var(--archive-rust)]/30 bg-[var(--archive-rust)]/8 px-3 py-2 text-sm text-[var(--archive-ink-black)]">
            Cleaned up {lastSyncResult.removedCount} missing file{lastSyncResult.removedCount !== 1 ? 's' : ''} from library.
          </div>
        )}

        <div className="mb-10">
          <h1 className="text-[2rem] leading-tight font-medium tracking-[-0.02em] text-[var(--archive-ink-black)]">
            Library Overview
          </h1>
          <p className="mt-2 text-[15px] text-[var(--archive-ink-grey)]">
            {showFavorites
              ? `Favorites view · ${favoritesCount} saved`
              : `All documents · ${items.length} files`}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="grid place-items-center py-24 text-center">
            <div>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full border border-black/10 bg-white grid place-items-center">
                <FolderPlus className="w-9 h-9 text-[var(--archive-ink-grey)]" />
              </div>
              <h2 className="text-2xl font-medium text-[var(--archive-ink-black)]">No PDF files yet</h2>
              <p className="mt-3 text-[var(--archive-ink-grey)] max-w-md">
                Import a folder to build your archive. You can also drag and drop a PDF into this page.
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="archive-btn-text archive-btn-primary mt-6"
              >
                Import Folder
              </button>
            </div>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="grid place-items-center py-24 text-center">
            <div>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full border border-black/10 bg-white grid place-items-center">
                <Search className="w-9 h-9 text-[var(--archive-ink-grey)]" />
              </div>
              <h2 className="text-2xl font-medium text-[var(--archive-ink-black)]">No results</h2>
              <p className="mt-3 text-[var(--archive-ink-grey)]">
                Try another keyword or turn off favorites filter.
              </p>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'archive-grid' : 'flex flex-col gap-2 pb-24'}>
            {sortedItems.map((item) => (
              <FileCard
                key={item.id}
                name={item.name}
                lastOpened={formatDate(item.lastOpened)}
                onClick={() => onOpenRecentFile(item.path)}
                isFavorite={Boolean(item.favorite)}
                onToggleFavorite={() => onToggleFavorite(item.id)}
                onRemove={() => onRemoveItem(item.id)}
                onRename={async (newName) => onRenameItem(item.id, newName)}
                metadata={item.metadata}
                thumbnail={item.metadata?.thumbnail}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </main>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        isImporting={isImporting}
      />

      {importProgress && <ImportProgress progress={importProgress} />}

      {importResult && (
        <ImportResult
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}
    </div>
  );
}
