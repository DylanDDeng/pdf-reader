import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Grid, List, FolderPlus, Star, Clock } from 'lucide-react';
import { FileCard } from './FileCard';
import { ImportModal } from './ImportModal';
import { ImportProgress } from './ImportProgress';
import { ImportResult } from './ImportResult';
import type { LibraryItem, ImportResult as ImportResultType, ImportProgress as ImportProgressType, ScannedFile } from '../../types/library';

interface LibraryViewProps {
  onOpenRecentFile: (path: string) => void;
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

  // Track previous triggerImport value to detect changes
  const prevTriggerImportRef = useRef(triggerImport);

  // Listen for import trigger from sidebar
  useEffect(() => {
    // Only trigger if the value has changed (increased)
    if (triggerImport !== prevTriggerImportRef.current && triggerImport && triggerImport > 0) {
      setShowImportModal(true);
    }
    prevTriggerImportRef.current = triggerImport;
  }, [triggerImport]);

  // Filter items based on search and favorites
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.path.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFavorites = !showFavorites || item.favorite;

    return matchesSearch && matchesFavorites;
  });

  // Sort items by last opened
  const sortedItems = [...filteredItems].sort((a, b) => {
    return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime();
  });

  // Favorites
  const favoriteItems = sortedItems.filter((item) => item.favorite);
  const recentItems = sortedItems.filter((item) => !item.favorite);

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f6f7f8] dark:bg-background-dark">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-background-dark border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-white">Library</h1>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Favorites Filter */}
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFavorites
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className={`w-4 h-4 ${showFavorites ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">Favorites</span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {/* Sync Notification */}
        {lastSyncResult && lastSyncResult.removedCount > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Cleaned up {lastSyncResult.removedCount} file{lastSyncResult.removedCount !== 1 ? 's' : ''} that no longer exist on disk.
            </span>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-12 h-12 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-slate-800 dark:text-white mb-2">
              No PDF files yet
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
              Import a folder to get started with your PDF library.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors font-medium flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Import Folder
            </button>
          </div>
        ) : showFavorites && favoriteItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Star className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-lg font-medium text-slate-800 dark:text-white mb-2">
              No favorites yet
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
              Star your favorite PDFs to access them quickly here.
            </p>
            <button
              onClick={() => setShowFavorites(false)}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors font-medium"
            >
              View All Files
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Search className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-lg font-medium text-slate-800 dark:text-white mb-2">
              No results found
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
              Try a different search term.
            </p>
          </div>
        ) : (
          <>
            {/* Favorites Section */}
            {favoriteItems.length > 0 && !showFavorites && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-amber-500 fill-current" />
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                    Favorites
                  </h2>
                  <span className="text-sm text-slate-400">
                    {favoriteItems.length}
                  </span>
                </div>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                      : 'flex flex-col gap-2'
                  }
                >
                  {favoriteItems.slice(0, 5).map((item) => (
                    <FileCard
                      key={item.id}
                      name={item.name}
                      lastOpened={formatDate(item.lastOpened)}
                      onClick={() => onOpenRecentFile(item.path)}
                      isFavorite={true}
                      onToggleFavorite={() => onToggleFavorite(item.id)}
                      onRemove={() => onRemoveItem(item.id)}
                      onRename={async (newName) => onRenameItem(item.id, newName)}
                      metadata={item.metadata}
                      thumbnail={item.metadata?.thumbnail}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Files Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {showFavorites ? 'Favorites' : 'Recent Files'}
                </h2>
                <span className="text-sm text-slate-400">
                  {showFavorites ? favoriteItems.length : recentItems.length}
                </span>
              </div>

              {(showFavorites ? favoriteItems : recentItems).length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  {showFavorites ? 'No favorite files' : 'No recent files'}
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                      : 'flex flex-col gap-2'
                  }
                >
                  {(showFavorites ? favoriteItems : recentItems).map((item) => (
                    <FileCard
                      key={item.id}
                      name={item.name}
                      lastOpened={formatDate(item.lastOpened)}
                      onClick={() => onOpenRecentFile(item.path)}
                      isFavorite={item.favorite}
                      onToggleFavorite={() => onToggleFavorite(item.id)}
                      onRemove={() => onRemoveItem(item.id)}
                      onRename={async (newName) => onRenameItem(item.id, newName)}
                      metadata={item.metadata}
                      thumbnail={item.metadata?.thumbnail}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        isImporting={isImporting}
      />

      {/* Import Progress */}
      {importProgress && (
        <ImportProgress progress={importProgress} />
      )}

      {/* Import Result */}
      {importResult && (
        <ImportResult
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}
    </div>
  );
}
