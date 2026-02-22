import { useCallback, useEffect, useState } from 'react';
import type { AiProvider, DefaultZoomMode, OpenFileLocationMode, ReaderSettings } from '../types/settings';

const STORAGE_KEY = 'pdf-reader-settings';

const DEFAULT_SETTINGS: ReaderSettings = {
  openFileLocation: 'last_read_page',
  defaultZoomMode: 'fit_width',
  arxivDownloadFolder: null,
  aiEnabled: true,
  aiProvider: 'openrouter',
  openRouterApiKey: '',
  openRouterModel: 'openai/gpt-4o-mini',
  aiReasoningEnabled: true,
  aiDailyUsageSoftLimit: 100,
};

function isOpenFileLocationMode(value: unknown): value is OpenFileLocationMode {
  return value === 'last_read_page' || value === 'first_page';
}

function isDefaultZoomMode(value: unknown): value is DefaultZoomMode {
  return value === 'fit_width' || value === 'fixed_100' || value === 'remember_last';
}

function isAiProvider(value: unknown): value is AiProvider {
  return value === 'openrouter';
}

function loadSettings(): ReaderSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as Partial<ReaderSettings>;
    const openFileLocation = isOpenFileLocationMode(parsed.openFileLocation)
      ? parsed.openFileLocation
      : DEFAULT_SETTINGS.openFileLocation;
    const defaultZoomMode = isDefaultZoomMode(parsed.defaultZoomMode)
      ? parsed.defaultZoomMode
      : DEFAULT_SETTINGS.defaultZoomMode;

    return {
      openFileLocation,
      defaultZoomMode,
      arxivDownloadFolder:
        typeof parsed.arxivDownloadFolder === 'string' && parsed.arxivDownloadFolder.trim().length > 0
          ? parsed.arxivDownloadFolder
          : null,
      aiEnabled: typeof parsed.aiEnabled === 'boolean' ? parsed.aiEnabled : DEFAULT_SETTINGS.aiEnabled,
      aiProvider: isAiProvider(parsed.aiProvider) ? parsed.aiProvider : DEFAULT_SETTINGS.aiProvider,
      openRouterApiKey: typeof parsed.openRouterApiKey === 'string' ? parsed.openRouterApiKey : DEFAULT_SETTINGS.openRouterApiKey,
      openRouterModel:
        typeof parsed.openRouterModel === 'string' && parsed.openRouterModel.trim().length > 0
          ? parsed.openRouterModel
          : DEFAULT_SETTINGS.openRouterModel,
      aiReasoningEnabled:
        typeof parsed.aiReasoningEnabled === 'boolean' ? parsed.aiReasoningEnabled : DEFAULT_SETTINGS.aiReasoningEnabled,
      aiDailyUsageSoftLimit: Number.isFinite(parsed.aiDailyUsageSoftLimit)
        ? Math.max(1, Math.floor(parsed.aiDailyUsageSoftLimit ?? DEFAULT_SETTINGS.aiDailyUsageSoftLimit))
        : DEFAULT_SETTINGS.aiDailyUsageSoftLimit,
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

  const setDefaultZoomMode = useCallback((defaultZoomMode: DefaultZoomMode) => {
    setSettings((prev) => {
      if (prev.defaultZoomMode === defaultZoomMode) {
        return prev;
      }
      return { ...prev, defaultZoomMode };
    });
  }, []);

  const setArxivDownloadFolder = useCallback((folder: string | null) => {
    const normalized = folder && folder.trim().length > 0 ? folder.trim() : null;
    setSettings((prev) => {
      if (prev.arxivDownloadFolder === normalized) {
        return prev;
      }
      return { ...prev, arxivDownloadFolder: normalized };
    });
  }, []);

  const setAiEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => (prev.aiEnabled === enabled ? prev : { ...prev, aiEnabled: enabled }));
  }, []);

  const setOpenRouterApiKey = useCallback((apiKey: string) => {
    setSettings((prev) => (prev.openRouterApiKey === apiKey ? prev : { ...prev, openRouterApiKey: apiKey }));
  }, []);

  const setOpenRouterModel = useCallback((model: string) => {
    setSettings((prev) => (prev.openRouterModel === model ? prev : { ...prev, openRouterModel: model }));
  }, []);

  const setAiReasoningEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => (prev.aiReasoningEnabled === enabled ? prev : { ...prev, aiReasoningEnabled: enabled }));
  }, []);

  const setAiDailyUsageSoftLimit = useCallback((limit: number) => {
    const normalized = Math.max(1, Math.floor(limit));
    setSettings((prev) => (prev.aiDailyUsageSoftLimit === normalized ? prev : { ...prev, aiDailyUsageSoftLimit: normalized }));
  }, []);

  return {
    settings,
    setSettings,
    setOpenFileLocation,
    setDefaultZoomMode,
    setArxivDownloadFolder,
    setAiEnabled,
    setOpenRouterApiKey,
    setOpenRouterModel,
    setAiReasoningEnabled,
    setAiDailyUsageSoftLimit,
  };
}
