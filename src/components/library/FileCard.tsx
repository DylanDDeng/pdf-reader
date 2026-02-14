import { useState } from 'react';
import { FileText, Clock, Star, Trash2 } from 'lucide-react';
import type { PdfMetadata } from '../../types/library';

interface FileCardProps {
  name: string;
  lastOpened?: string;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onRemove?: () => void;
  metadata?: PdfMetadata;
  viewMode?: 'grid' | 'list';
  thumbnail?: string;
}

export function FileCard({
  name,
  lastOpened,
  onClick,
  isFavorite = false,
  onToggleFavorite,
  onRemove,
  metadata,
  viewMode = 'grid',
  thumbnail,
}: FileCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Format file size helper
  const formatPageCount = (count?: number) => {
    if (!count) return null;
    return `${count} page${count !== 1 ? 's' : ''}`;
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-slate-200 dark:border-slate-700 group"
      >
        {/* PDF Icon */}
        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-red-500" />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-800 dark:text-white text-sm truncate">
            {name}
          </h3>
          {metadata?.pageCount && (
            <span className="text-xs text-slate-400">
              {formatPageCount(metadata.pageCount)}
            </span>
          )}
        </div>

        {/* Last Opened */}
        {lastOpened && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span>{lastOpened}</span>
          </div>
        )}

        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              isFavorite
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Delete Button */}
        {onRemove && !showDeleteConfirm && (
          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors flex-shrink-0"
            title="Remove from library"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleConfirmDelete}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={handleCancelDelete}
              className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-700 group relative"
    >
      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              isFavorite
                ? 'text-amber-500 hover:text-amber-600 bg-white/80 dark:bg-slate-800/80'
                : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 hover:bg-white/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Delete Button */}
        {onRemove && !showDeleteConfirm && (
          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors bg-white/80 dark:bg-slate-800/80 hover:bg-white/80 dark:hover:bg-slate-800/80"
            title="Remove from library"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-1">
            <button
              onClick={handleConfirmDelete}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={handleCancelDelete}
              className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* PDF Icon or Thumbnail */}
      <div className="w-full aspect-[3/4] bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center mb-3 overflow-hidden group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText className="w-12 h-12 text-red-500" />
        )}
      </div>

      {/* File Name */}
      <h3 className="font-medium text-slate-800 dark:text-white text-sm truncate mb-1 pr-16">
        {name}
      </h3>

      {/* Metadata / Last Opened */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        {lastOpened && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{lastOpened}</span>
          </div>
        )}
        {metadata?.pageCount && (
          <>
            {lastOpened && <span className="text-slate-300 dark:text-slate-600">•</span>}
            <span>{formatPageCount(metadata.pageCount)}</span>
          </>
        )}
      </div>
    </div>
  );
}
