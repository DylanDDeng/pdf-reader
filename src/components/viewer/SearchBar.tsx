import { useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  currentMatch: number;
  totalMatches: number;
  query: string;
}

export function SearchBar({
  onSearch,
  onNext,
  onPrev,
  onClose,
  currentMatch,
  totalMatches,
  query,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matchLabel = query.trim()
    ? totalMatches > 0
      ? `${currentMatch + 1} / ${totalMatches}`
      : '无结果'
    : '';

  return (
    <div className="archive-search-bar">
      <input
        ref={inputRef}
        type="text"
        className="archive-search-bar-input"
        placeholder="搜索文档..."
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrev(); else onNext();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      {matchLabel && (
        <span className="archive-search-bar-count">{matchLabel}</span>
      )}
      <button
        className="archive-search-bar-btn"
        onClick={onPrev}
        disabled={totalMatches === 0}
        title="上一个 (Shift+Enter)"
        aria-label="上一个匹配"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <button
        className="archive-search-bar-btn"
        onClick={onNext}
        disabled={totalMatches === 0}
        title="下一个 (Enter)"
        aria-label="下一个匹配"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      <button
        className="archive-search-bar-btn"
        onClick={onClose}
        title="关闭 (Esc)"
        aria-label="关闭搜索"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
