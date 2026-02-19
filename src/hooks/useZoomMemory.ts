import { useCallback, useState } from 'react';

interface ZoomMemoryItem {
  scale: number;
  updatedAt: string;
}

type ZoomMemoryMap = Record<string, ZoomMemoryItem>;

const STORAGE_KEY = 'pdf-reader-zoom-memory';

function normalizeScale(scale: number): number {
  return Math.round(scale * 100) / 100;
}

function loadZoomMemoryMap(): ZoomMemoryMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as ZoomMemoryMap;
  } catch (error) {
    console.error('Failed to load zoom memory:', error);
    return {};
  }
}

export function useZoomMemory() {
  const [zoomMemoryMap, setZoomMemoryMap] = useState<ZoomMemoryMap>(loadZoomMemoryMap);

  const persist = useCallback((nextMap: ZoomMemoryMap) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
    } catch (error) {
      console.error('Failed to save zoom memory:', error);
    }
  }, []);

  const getLastScale = useCallback((documentKey: string): number | null => {
    if (!documentKey) {
      return null;
    }

    const entry = zoomMemoryMap[documentKey];
    if (!entry || !Number.isFinite(entry.scale) || entry.scale <= 0) {
      return null;
    }

    return normalizeScale(entry.scale);
  }, [zoomMemoryMap]);

  const setLastScale = useCallback((documentKey: string, scale: number) => {
    if (!documentKey || !Number.isFinite(scale) || scale <= 0) {
      return;
    }

    const normalizedScale = normalizeScale(scale);

    setZoomMemoryMap((prev) => {
      const existing = prev[documentKey];
      if (existing && Math.abs(existing.scale - normalizedScale) < 0.001) {
        return prev;
      }

      const next = {
        ...prev,
        [documentKey]: {
          scale: normalizedScale,
          updatedAt: new Date().toISOString(),
        },
      };

      persist(next);
      return next;
    });
  }, [persist]);

  const removeScale = useCallback((documentKey: string) => {
    if (!documentKey) {
      return;
    }

    setZoomMemoryMap((prev) => {
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
    getLastScale,
    setLastScale,
    removeScale,
  };
}
