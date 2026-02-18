import { useCallback, useState } from 'react';

interface ReadingProgressItem {
  lastPage: number;
  updatedAt: string;
}

type ReadingProgressMap = Record<string, ReadingProgressItem>;

const STORAGE_KEY = 'pdf-reader-reading-progress';

function loadProgressMap(): ReadingProgressMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as ReadingProgressMap;
  } catch (error) {
    console.error('Failed to load reading progress:', error);
    return {};
  }
}

export function useReadingProgress() {
  const [progressMap, setProgressMap] = useState<ReadingProgressMap>(loadProgressMap);

  const persist = useCallback((nextMap: ReadingProgressMap) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
    } catch (error) {
      console.error('Failed to save reading progress:', error);
    }
  }, []);

  const getLastPage = useCallback((documentKey: string): number | null => {
    if (!documentKey) {
      return null;
    }

    const entry = progressMap[documentKey];
    if (!entry || !Number.isFinite(entry.lastPage) || entry.lastPage < 1) {
      return null;
    }

    return Math.floor(entry.lastPage);
  }, [progressMap]);

  const setLastPage = useCallback((documentKey: string, page: number) => {
    if (!documentKey || !Number.isFinite(page) || page < 1) {
      return;
    }

    const normalizedPage = Math.floor(page);

    setProgressMap((prev) => {
      const existing = prev[documentKey];
      if (existing?.lastPage === normalizedPage) {
        return prev;
      }

      const next = {
        ...prev,
        [documentKey]: {
          lastPage: normalizedPage,
          updatedAt: new Date().toISOString(),
        },
      };

      persist(next);
      return next;
    });
  }, [persist]);

  const removeProgress = useCallback((documentKey: string) => {
    if (!documentKey) {
      return;
    }

    setProgressMap((prev) => {
      if (!(documentKey in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[documentKey];
      persist(next);
      return next;
    });
  }, [persist]);

  return {
    getLastPage,
    setLastPage,
    removeProgress,
  };
}

