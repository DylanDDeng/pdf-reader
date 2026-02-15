import { useState, useRef, useEffect } from 'react';
import { Clock, Star, Trash2, Pencil, MoreVertical } from 'lucide-react';
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

const CARD_THEMES = ['rust', 'green', 'magenta', 'blue'] as const;
const CARD_SHAPES = ['circle', 'slash', 'block', 'spot'] as const;

type CardTheme = (typeof CARD_THEMES)[number];
type CardShape = (typeof CARD_SHAPES)[number];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickTheme(name: string): CardTheme {
  return CARD_THEMES[hashString(name) % CARD_THEMES.length];
}

function pickShape(name: string): CardShape {
  return CARD_SHAPES[hashString(`${name}-shape`) % CARD_SHAPES.length];
}

function resolveMetaLabel(metadata?: PdfMetadata): string {
  if (metadata?.author) return metadata.author;
  if (metadata?.subject) return metadata.subject;
  if (metadata?.creator) return metadata.creator;
  return 'PDF Document';
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

  const cardTheme = pickTheme(name);
  const cardShape = pickShape(name);
  const pageCount = metadata?.pageCount ?? null;
  const statValue = pageCount ? String(pageCount).padStart(2, '0') : '--';
  const statSuffix = pageCount ? 'pg' : 'doc';
  const stampText = (lastOpened ?? 'archive').toUpperCase();
  const metaLabel = resolveMetaLabel(metadata);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      const nameWithoutExt = renameValue.replace(/\.pdf$/i, '');
      inputRef.current.setSelectionRange(0, nameWithoutExt.length);
    }
  }, [isRenaming, renameValue]);

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

  const formatPageCount = (count?: number) => {
    if (!count) return null;
    return `${count} page${count !== 1 ? 's' : ''}`;
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowContextMenu(false);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
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
          setRenameValue(name);
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
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.right + 6, y: rect.bottom + 6 });
    setShowContextMenu((prev) => !prev);
  };

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
        className={`flex items-center gap-3 bg-white/95 rounded-xl px-4 py-3 cursor-pointer border border-black/10 hover:bg-white transition-colors group ${isRenaming ? 'ring-2 ring-[var(--archive-blue)]' : ''}`}
      >
        <div className="w-10 h-10 rounded-lg border border-black/10 bg-[var(--archive-paper-bg)] grid place-items-center">
          <span
            className="w-4 h-4 rounded-full opacity-75"
            style={{ backgroundColor: `var(--archive-${cardTheme})` }}
          />
        </div>

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
                className="flex-1 px-2 py-1 text-sm border border-black/15 rounded focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="submit"
                disabled={isRenamingInProgress}
                className="px-2 py-1 text-xs bg-[var(--archive-ink-black)] text-white rounded disabled:opacity-50"
                onClick={(e) => e.stopPropagation()}
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleRenameCancel}
                disabled={isRenamingInProgress}
                className="px-2 py-1 text-xs bg-black/10 text-[var(--archive-ink-black)] rounded"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h3 className="font-medium text-[var(--archive-ink-black)] text-sm truncate">{name}</h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--archive-ink-grey)]">
                {metadata?.pageCount && <span>{formatPageCount(metadata.pageCount)}</span>}
                {lastOpened && (
                  <>
                    {metadata?.pageCount && <span>•</span>}
                    <span>{lastOpened}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {!isRenaming && lastOpened && (
          <div className="flex items-center gap-1 text-xs text-[var(--archive-ink-grey)]">
            <Clock className="w-3 h-3" />
            <span>{lastOpened}</span>
          </div>
        )}

        {onToggleFavorite && !isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              isFavorite
                ? 'text-[var(--archive-rust)]'
                : 'text-black/25 hover:text-[var(--archive-rust)] opacity-0 group-hover:opacity-100'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}

        {(onRename || onRemove) && !isRenaming && !showDeleteConfirm && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleContextMenuClick}
              className="p-1.5 rounded-lg text-black/25 hover:text-black/60 opacity-0 group-hover:opacity-100 transition-colors"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showContextMenu && (
              <div
                className="fixed bg-white rounded-lg shadow-lg border border-black/10 py-1 z-50 min-w-[120px]"
                style={{ left: menuPosition.x, top: menuPosition.y }}
              >
                {onRename && (
                  <button
                    onClick={handleRenameClick}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--archive-ink-black)] hover:bg-black/5 flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={handleDeleteClick}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--archive-rust)] hover:bg-black/5 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {showDeleteConfirm && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleConfirmDelete}
              className="px-2 py-1 text-xs bg-[var(--archive-rust)] text-white rounded"
            >
              Confirm
            </button>
            <button
              onClick={handleCancelDelete}
              className="px-2 py-1 text-xs bg-black/10 text-[var(--archive-ink-black)] rounded"
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
      className={`archive-card group relative ${isRenaming ? 'ring-2 ring-[var(--archive-blue)]' : ''}`}
      data-theme={cardTheme}
    >
      <div className="absolute top-2.5 right-2.5 z-[3] flex items-center gap-1">
        {onToggleFavorite && !isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`archive-icon-btn ${
              isFavorite
                ? 'text-[var(--archive-rust)] opacity-100'
                : 'text-black/30 opacity-0 group-hover:opacity-100'
            }`}
            title="Favorite"
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}

        {(onRename || onRemove) && !isRenaming && !showDeleteConfirm && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleContextMenuClick}
              className="archive-icon-btn text-black/30 opacity-0 group-hover:opacity-100"
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showContextMenu && (
              <div
                className="fixed bg-white rounded-lg shadow-lg border border-black/10 py-1 z-50 min-w-[120px]"
                style={{ left: menuPosition.x, top: menuPosition.y }}
              >
                {onRename && (
                  <button
                    onClick={handleRenameClick}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--archive-ink-black)] hover:bg-black/5 flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={handleDeleteClick}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--archive-rust)] hover:bg-black/5 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="absolute top-2.5 left-2.5 z-[4] flex items-center gap-1 bg-white/95 rounded-md border border-black/10 p-1">
          <button
            onClick={handleConfirmDelete}
            className="px-2 py-1 text-xs bg-[var(--archive-rust)] text-white rounded"
          >
            Confirm
          </button>
          <button
            onClick={handleCancelDelete}
            className="px-2 py-1 text-xs bg-black/10 text-[var(--archive-ink-black)] rounded"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="archive-card-header">
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
              className="w-full px-2 py-1 text-sm border border-black/15 rounded focus:outline-none bg-white"
            />
            <div className="flex items-center gap-1">
              <button
                type="submit"
                disabled={isRenamingInProgress}
                className="flex-1 px-2 py-1 text-xs bg-[var(--archive-ink-black)] text-white rounded disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleRenameCancel}
                disabled={isRenamingInProgress}
                className="flex-1 px-2 py-1 text-xs bg-black/10 text-[var(--archive-ink-black)] rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="archive-file-title" title={name}>{name}</h3>
            <span className="archive-meta-label" title={metaLabel}>{metaLabel}</span>
          </>
        )}
      </div>

      <div className="archive-thumbnail-container">
        {thumbnail && (
          <img
            src={thumbnail}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale contrast-[1.05]"
            draggable={false}
          />
        )}
        <div className={`archive-dot-matrix archive-shape-${cardShape}`} />
      </div>

      <div className="archive-card-footer">
        <div className="archive-stat-group">
          <div className="archive-stat-val">
            {statValue}
            <span className="archive-stat-suffix">{statSuffix}</span>
          </div>
        </div>
        <div className="archive-year-stamp">{stampText}</div>
      </div>
    </div>
  );
}
