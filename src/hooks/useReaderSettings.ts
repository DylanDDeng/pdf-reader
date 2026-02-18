import { useCallback, useEffect, useState } from 'react';
import type { OpenFileLocationMode, ReaderSettings } from '../types/settings';

const STORAGE_KEY = 'pdf-reader-settings';

const DEFAULT_SETTINGS: ReaderSettings = {
  openFileLocation: 'last_read_page',
};

function isOpenFileLocationMode(value: unknown): value is OpenFileLocationMode {
  return value === 'last_read_page' || value === 'first_page';
}

function loadSettings(): ReaderSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as Partial<ReaderSettings>;
    if (!isOpenFileLocationMode(parsed.openFileLocation)) {
      return DEFAULT_SETTINGS;
    }

    return {
      openFileLocation: parsed.openFileLocation,
    };
  } catch (error) {
    console.error('Failed to load reader settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save reader settings:', error);
    }
  }, [settings]);

  const setOpenFileLocation = useCallback((openFileLocation: OpenFileLocationMode) => {
    setSettings((prev) => {
      if (prev.openFileLocation === openFileLocation) {
        return prev;
      }
      return { ...prev, openFileLocation };
    });
  }, []);

  return {
    settings,
    setSettings,
    setOpenFileLocation,
  };
}

