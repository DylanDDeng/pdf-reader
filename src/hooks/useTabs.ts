import { useState, useCallback, useRef } from 'react';
import { getDocumentKey } from '../utils/documentKey';

export type TabZoomMode = 'fit_width' | 'custom';

export interface Tab {
  id: string;
  file: File | string;
  fileName: string;
  annotationKey: string;
  currentPage: number;
  scale: number;
  zoomMode: TabZoomMode;
  // 用于恢复滚动位置等
  scrollPosition?: number;
}

interface OpenFileOptions {
  initialPage?: number;
  initialScale?: number;
  initialZoomMode?: TabZoomMode;
}

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabIdCounter = useRef(0);

  // 生成唯一标签页 ID
  const generateTabId = useCallback(() => {
    tabIdCounter.current += 1;
    return `tab-${Date.now()}-${tabIdCounter.current}`;
  }, []);

  // 获取文件名（从 File 对象或路径）
  const getFileName = useCallback((file: File | string): string => {
    if (typeof file === 'string') {
      return file.split('/').pop() || 'Document';
    }
    return file.name;
  }, []);

  // 打开新文件（添加标签页）
  const openFile = useCallback((file: File | string, options?: OpenFileOptions) => {
    const fileName = getFileName(file);
    const annotationKey = getDocumentKey(file);
    
    // 检查是否已打开
    const existingTab = tabs.find(t => {
      if (typeof file === 'string' && typeof t.file === 'string') {
        return t.file === file;
      }
      if (file instanceof File && t.file instanceof File) {
        return t.file.name === file.name && t.file.size === file.size;
      }
      return false;
    });

    if (existingTab) {
      // 切换到已存在的标签页
      setActiveTabId(existingTab.id);
      return existingTab.id;
    }

    const initialPage = Number.isFinite(options?.initialPage)
      ? Math.max(1, Math.floor(options?.initialPage ?? 1))
      : 1;
    const initialScale = Number.isFinite(options?.initialScale)
      ? Math.max(0.25, Math.min(options?.initialScale ?? 1, 4))
      : 1;
    const initialZoomMode = options?.initialZoomMode === 'fit_width' ? 'fit_width' : 'custom';

    // 创建新标签页
    const newTab: Tab = {
      id: generateTabId(),
      file,
      fileName,
      annotationKey,
      currentPage: initialPage,
      scale: initialScale,
      zoomMode: initialZoomMode,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab.id;
  }, [tabs, generateTabId, getFileName]);

  // 关闭标签页
  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      
      // 如果关闭的是当前激活的标签页，切换到相邻的标签页
      if (activeTabId === tabId) {
        const closedIndex = prev.findIndex(t => t.id === tabId);
        const newActiveIndex = Math.min(closedIndex, newTabs.length - 1);
        setActiveTabId(newTabs[newActiveIndex]?.id || null);
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  // 切换标签页
  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // 更新标签页状态
  const updateTab = useCallback((tabId: string, updates: Partial<Omit<Tab, 'id' | 'file' | 'fileName' | 'annotationKey'>>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  }, []);

  // 获取当前激活的标签页
  const activeTab = tabs.find(t => t.id === activeTabId) || null;

  return {
    tabs,
    activeTabId,
    activeTab,
    openFile,
    closeTab,
    switchTab,
    updateTab,
  };
}
