import { useState, useCallback, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface SearchMatch {
  pageNumber: number;
  index: number;
  length: number;
}

export interface UseSearchReturn {
  isSearchOpen: boolean;
  query: string;
  matches: SearchMatch[];
  currentMatchIndex: number;
  openSearch: () => void;
  closeSearch: () => void;
  search: (query: string) => void;
  nextMatch: () => void;
  prevMatch: () => void;
}

interface PageText {
  pageNumber: number;
  text: string;
}

export function useSearch(docRef: React.RefObject<PDFDocumentProxy | null>): UseSearchReturn {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const textCacheRef = useRef<PageText[] | null>(null);
  const buildingRef = useRef(false);

  const buildTextIndex = useCallback(async (): Promise<PageText[]> => {
    if (textCacheRef.current) return textCacheRef.current;
    const doc = docRef.current;
    if (!doc) return [];
    if (buildingRef.current) return [];

    buildingRef.current = true;
    const pages: PageText[] = [];
    const totalPages = doc.numPages;
    const batchSize = 10;

    try {
      for (let start = 1; start <= totalPages; start += batchSize) {
        const end = Math.min(start + batchSize - 1, totalPages);
        const batch = [];
        for (let i = start; i <= end; i++) {
          batch.push(
            doc.getPage(i).then(async (page) => {
              const content = await page.getTextContent();
              const text = content.items
                .map((item: any) => ('str' in item ? item.str : ''))
                .join(' ');
              return { pageNumber: i, text };
            })
          );
        }
        const results = await Promise.all(batch);
        pages.push(...results);
      }

      pages.sort((a, b) => a.pageNumber - b.pageNumber);
      textCacheRef.current = pages;
      return pages;
    } finally {
      buildingRef.current = false;
    }
  }, [docRef]);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const pages = await buildTextIndex();
    const lowerQ = q.toLowerCase();
    const found: SearchMatch[] = [];

    for (const page of pages) {
      const lowerText = page.text.toLowerCase();
      let pos = 0;
      while (true) {
        const idx = lowerText.indexOf(lowerQ, pos);
        if (idx === -1) break;
        found.push({
          pageNumber: page.pageNumber,
          index: idx,
          length: q.length,
        });
        pos = idx + 1;
      }
    }

    setMatches(found);
    setCurrentMatchIndex(found.length > 0 ? 0 : -1);
  }, [buildTextIndex]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setQuery('');
    setMatches([]);
    setCurrentMatchIndex(-1);
  }, []);

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  return {
    isSearchOpen,
    query,
    matches,
    currentMatchIndex,
    openSearch,
    closeSearch,
    search: (q: string) => { void search(q); },
    nextMatch,
    prevMatch,
  };
}
