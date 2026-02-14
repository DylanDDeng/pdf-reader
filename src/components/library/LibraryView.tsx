import { useState } from 'react';
import { Search, Grid, List } from 'lucide-react';
import { FileCard } from './FileCard';

interface RecentFile {
  name: string;
  path: string;
  lastOpened: string;
}

interface LibraryViewProps {
  onOpenFile: () => void;
  onOpenRecentFile: (path: string) => void;
  recentFiles: RecentFile[];
}

export function LibraryView({ onOpenFile, onOpenRecentFile, recentFiles }: LibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredFiles = recentFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-[#f6f7f8] dark:bg-background-dark">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-[#101922] border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6">
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
        {/* Empty State */}
        {recentFiles.length === 0 ? (
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
              Open a PDF file to get started. Your recently opened files will appear here.
            </p>
            <button
              onClick={onOpenFile}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors font-medium"
            >
              Open PDF File
            </button>
          </div>
        ) : (
          <>
            {/* Recent Files Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                Recent Files
              </h2>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                    : 'flex flex-col gap-2'
                }
              >
                {filteredFiles.map((file, index) => (
                  <FileCard
                    key={index}
                    name={file.name}
                    lastOpened={file.lastOpened}
                    onClick={() => onOpenRecentFile(file.path)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
