import { useState, useRef, useEffect } from 'react';
import { FileText, Clock, Star, Trash2, Pencil, MoreVertical } from 'lucide-react';
import type { PdfMetadata } from '../../types/library';

interface FileCardProps {
  name: string;
  lastOpened?: string;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onRemove?: () => void;
  onRename?: (newName: string) => Promise<{ success: boolean; error?: string }>;
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
  onRename,
  metadata,
  viewMode = 'grid',
  thumbnail,
}: FileCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const [isRenamingInProgress, setIsRenamingInProgress] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // Select text without the .pdf extension
      const nameWithoutExt = renameValue.replace(/\.pdf$/i, '');
      inputRef.current.setSelectionRange(0, nameWithoutExt.length);
    }
  }, [isRenaming, renameValue]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

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

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContextMenu(false);
    setRenameValue(name);
    setIsRenaming(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newName = renameValue.trim();
    if (!newName || newName === name) {
      setIsRenaming(false);
      return;
    }

    if (onRename) {
      setIsRenamingInProgress(true);
      try {
        const result = await onRename(newName);
        if (result.success) {
          setIsRenaming(false);
        } else {
          // Show error - reset to original name
          setRenameValue(name);
          // Could add toast notification here
          console.error('Rename failed:', result.error);
        }
      } finally {
        setIsRenamingInProgress(false);
      }
    } else {
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = (e: React.MouseEvent | React.KeyboardEvent | React.FocusEvent) => {
    e.stopPropagation();
    setRenameValue(name);
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleRenameCancel(e);
    }
  };

  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Set menu position near the button
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.right, y: rect.bottom });
    setShowContextMenu(!showContextMenu);
  };

  // Right-click context menu handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={isRenaming ? undefined : onClick}
        onContextMenu={handleContextMenu}
        className={`flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-slate-200 dark:border-slate-700 group ${isRenaming ? 'ring-2 ring-primary' : ''}`}
      >
        {/* PDF Icon */}
        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-red-500" />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={(e) => {
                  if (!e.relatedTarget) {
                    handleRenameCancel(e);
                  }
                }}
                disabled={isRenamingInProgress}
                className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-primary rounded focus:outline-none text-slate-800 dark:text-white"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="submit"
                disabled={isRenamingInProgress}
                className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                onClick={(e) => e.stopPropagation()}
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleRenameCancel}
                disabled={isRenamingInProgress}
                className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h3 className="font-medium text-slate-800 dark:text-white text-sm truncate">
                {name}
              </h3>
              {metadata?.pageCount && (
                <span className="text-xs text-slate-400">
                  {formatPageCount(metadata.pageCount)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Last Opened */}
        {lastOpened && !isRenaming && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span>{lastOpened}</span>
          </div>
        )}

        {/* Favorite Button */}
        {onToggleFavorite && !isRenaming && (
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

        {/* More Options / Context Menu */}
        {(onRename || onRemove) && !isRenaming && !showDeleteConfirm && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleContextMenuClick}
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-colors flex-shrink-0"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Context Menu */}
            {showContextMenu && (
              <div
                className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 min-w-[120px]"
                style={{ left: menuPosition.x, top: menuPosition.y }}
              >
                {onRename && (
                  <button
                    onClick={handleRenameClick}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={handleDeleteClick}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
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
      onClick={isRenaming ? undefined : onClick}
      onContextMenu={handleContextMenu}
      className={`bg-white dark:bg-slate-800 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-700 group relative ${isRenaming ? 'ring-2 ring-primary' : ''}`}
    >
      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {/* Favorite Button */}
        {onToggleFavorite && !isRenaming && (
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

        {/* More Options / Context Menu */}
        {(onRename || onRemove) && !isRenaming && !showDeleteConfirm && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleContextMenuClick}
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-colors bg-white/80 dark:bg-slate-800/80 hover:bg-white/80 dark:hover:bg-slate-800/80"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Context Menu */}
            {showContextMenu && (
              <div
                className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 min-w-[120px]"
                style={{ left: menuPosition.x, top: menuPosition.y }}
              >
                {onRename && (
                  <button
                    onClick={handleRenameClick}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={handleDeleteClick}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
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

      {/* File Name / Rename Input */}
      {isRenaming ? (
        <form onSubmit={handleRenameSubmit} className="mb-1">
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={(e) => {
              if (!e.relatedTarget) {
                handleRenameCancel(e);
              }
            }}
            disabled={isRenamingInProgress}
            className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-primary rounded focus:outline-none text-slate-800 dark:text-white mb-2"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-1">
            <button
              type="submit"
              disabled={isRenamingInProgress}
              className="flex-1 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
              onClick={(e) => e.stopPropagation()}
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleRenameCancel}
              disabled={isRenamingInProgress}
              className="flex-1 px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
