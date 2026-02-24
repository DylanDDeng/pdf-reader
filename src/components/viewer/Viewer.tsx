import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, FileText, ChevronRight } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSidebar } from './ReaderSidebar';
import { PdfViewer, type AnnotationClickContext } from './PdfViewer';
import { AnnotationPanel } from './AnnotationPanel';
import { AiResultPanel } from './AiResultPanel';
import { ChatPanel } from './ChatPanel';
import { SearchBar } from './SearchBar';
import type { Tab } from '../../hooks/useTabs';
import type { Annotation, HighlightColor } from '../../types/annotation';
import type { AiRuntimeConfig, ChatMessage } from '../../types/ai';
import type { OutlineItem } from '../../utils/pdf';
import { AiServiceError } from '../../types/ai';
import { useAnnotations } from '../../hooks/useAnnotations';
import { useSearch } from '../../hooks/useSearch';
import { streamOpenRouterChatCompletion } from '../../services/aiService';
import { extractPageText, extractDocumentText } from '../../utils/pdfTextExtract';

interface ViewerProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabUpdate: (
    tabId: string,
    updates: Partial<Omit<Tab, 'id' | 'file' | 'fileName' | 'annotationKey'>>
  ) => void;
  aiConfig: AiRuntimeConfig;
  onAiRequestFinished?: (success: boolean) => void;
}

const SCALE_STEP = 0.25;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

interface FocusGuideState {
  source: { x: number; y: number };
  target: { x: number; y: number };
}

export function Viewer({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabUpdate,
  aiConfig,
  onAiRequestFinished,
}: ViewerProps) {
  const [tabPageCounts, setTabPageCounts] = useState<Record<string, number>>({});
  const [tabOutlines, setTabOutlines] = useState<Record<string, OutlineItem[]>>({});
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'outline'>('thumbnails');
  const [mountedTabIds, setMountedTabIds] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [focusOrigin, setFocusOrigin] = useState<{ x: number; y: number } | null>(null);
  const [focusGuide, setFocusGuide] = useState<FocusGuideState | null>(null);
  const [panelAttention, setPanelAttention] = useState(false);
  const [attentionAnnotationId, setAttentionAnnotationId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1920, height: 1080 });
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [summaryState, setSummaryState] = useState<{
    open: boolean;
    title: string;
    content: string;
    status: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
    error: string | null;
    warning: string | null;
    truncated: boolean;
    mode: 'page' | 'doc';
  }>({
    open: false, title: '', content: '', status: 'idle',
    error: null, warning: null, truncated: false, mode: 'page',
  });

  const annotationPanelRef = useRef<HTMLDivElement | null>(null);
  const focusGuideSeqRef = useRef(0);
  const focusGuideRafRef = useRef<number | null>(null);
  const focusGuideTimerRefs = useRef<number[]>([]);
  const previousTabCountRef = useRef(tabs.length);
  const tabDocRefs = useRef<Map<string, PDFDocumentProxy>>(new Map());
  const summaryAbortRef = useRef<AbortController | null>(null);
  const summaryStopRef = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageInputRef = useRef<HTMLInputElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Search hook - uses the active tab's PDFDocumentProxy
  const activeDocRef = useRef<PDFDocumentProxy | null>(null);
  activeDocRef.current = activeTab ? (tabDocRefs.current.get(activeTab.id) ?? null) : null;
  const {
    isSearchOpen,
    query: searchQuery,
    matches: searchMatches,
    currentMatchIndex: searchMatchIndex,
    openSearch,
    closeSearch,
    search: doSearch,
    nextMatch,
    prevMatch,
  } = useSearch(activeDocRef);

  const fileId = activeTab?.annotationKey ?? null;
  const {
    annotations,
    addHighlight,
    addUnderline,
    deleteAnnotation,
    updateComment,
    getAllAnnotations,
  } = useAnnotations(fileId);

  const clearFocusGuideAnimation = useCallback(() => {
    if (focusGuideRafRef.current !== null) {
      cancelAnimationFrame(focusGuideRafRef.current);
      focusGuideRafRef.current = null;
    }
    focusGuideTimerRefs.current.forEach((timerId) => {
      clearTimeout(timerId);
    });
    focusGuideTimerRefs.current = [];
    setFocusOrigin(null);
    setFocusGuide(null);
    setPanelAttention(false);
    setAttentionAnnotationId(null);
  }, []);

  const triggerAnnotationFocusGuide = useCallback((annotationId: string, context?: AnnotationClickContext) => {
    if (!context) {
      return;
    }

    clearFocusGuideAnimation();
    const seq = ++focusGuideSeqRef.current;
    const source = { x: context.clientX, y: context.clientY };
    setFocusOrigin(source);
    setPanelAttention(true);
    setAttentionAnnotationId(annotationId);

    const hideOriginTimer = window.setTimeout(() => {
      if (focusGuideSeqRef.current !== seq) {
        return;
      }
      setFocusOrigin(null);
    }, 520);
    focusGuideTimerRefs.current.push(hideOriginTimer);

    let attempts = 0;
    const maxAttempts = 70;

    const resolveTarget = () => {
      if (focusGuideSeqRef.current !== seq) {
        return;
      }

      const card = annotationPanelRef.current?.querySelector<HTMLDivElement>(
        `[data-annotation-id="${annotationId}"]`
      );

      if (!card) {
        attempts += 1;
        if (attempts <= maxAttempts) {
          focusGuideRafRef.current = requestAnimationFrame(resolveTarget);
        }
        return;
      }

      card.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const trackingStart = performance.now();
      const trackingDuration = 760;

      const trackTarget = () => {
        if (focusGuideSeqRef.current !== seq) {
          return;
        }

        const rect = card.getBoundingClientRect();
        setFocusGuide({
          source,
          target: {
            x: rect.left + Math.min(36, Math.max(20, rect.width * 0.18)),
            y: rect.top + rect.height / 2,
          },
        });

        if (performance.now() - trackingStart < trackingDuration) {
          focusGuideRafRef.current = requestAnimationFrame(trackTarget);
        }
      };

      trackTarget();
    };

    focusGuideRafRef.current = requestAnimationFrame(resolveTarget);

    const finishTimer = window.setTimeout(() => {
      if (focusGuideSeqRef.current !== seq) {
        return;
      }
      setFocusOrigin(null);
      setFocusGuide(null);
      setPanelAttention(false);
      setAttentionAnnotationId(null);
    }, 1750);
    focusGuideTimerRefs.current.push(finishTimer);
  }, [clearFocusGuideAnimation]);

  const focusGuidePath = useMemo(() => {
    if (!focusGuide) {
      return '';
    }
    const { source, target } = focusGuide;
    const deltaX = target.x - source.x;
    const curveSpan = Math.max(120, Math.abs(deltaX) * 0.34);
    const c1x = source.x + curveSpan;
    const c2x = target.x - curveSpan;
    const c1y = source.y;
    const c2y = target.y;
    return `M ${source.x} ${source.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`;
  }, [focusGuide]);

  useEffect(() => {
    clearFocusGuideAnimation();
    setSelectedAnnotationId(null);
    setShowAnnotations(false);
    setEraseMode(false);
    setShowChat(false);
    setChatMessages([]);
    setChatStreaming(false);
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    summaryAbortRef.current?.abort();
    summaryAbortRef.current = null;
    setSummaryState((prev) => ({ ...prev, open: false, status: 'idle' }));
    closeSearch();
  }, [activeTabId, clearFocusGuideAnimation, closeSearch]);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => {
      window.removeEventListener('resize', updateViewportSize);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearFocusGuideAnimation();
    };
  }, [clearFocusGuideAnimation]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }
    setMountedTabIds((prev) => (prev.includes(activeTabId) ? prev : [...prev, activeTabId]));
  }, [activeTabId]);

  useEffect(() => {
    setMountedTabIds((prev) => prev.filter((tabId) => tabs.some((tab) => tab.id === tabId)));
    setTabPageCounts((prev) => {
      const aliveIds = new Set(tabs.map((tab) => tab.id));
      let changed = false;
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([tabId, count]) => {
        if (aliveIds.has(tabId)) {
          next[tabId] = count;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setTabOutlines((prev) => {
      const aliveIds = new Set(tabs.map((tab) => tab.id));
      let changed = false;
      const next: Record<string, OutlineItem[]> = {};
      Object.entries(prev).forEach(([tabId, items]) => {
        if (aliveIds.has(tabId)) {
          next[tabId] = items;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tabs]);

  useEffect(() => {
    if (tabs.length > previousTabCountRef.current) {
      setIsSidebarOpen(false);
    }
    previousTabCountRef.current = tabs.length;
  }, [tabs.length]);

  const handleDocumentLoad = useCallback((tabId: string, pages: number, outline?: OutlineItem[]) => {
    const safePages = Math.max(1, Math.floor(pages || 1));
    setTabPageCounts((prev) => (prev[tabId] === safePages ? prev : { ...prev, [tabId]: safePages }));

    if (outline) {
      setTabOutlines((prev) => ({ ...prev, [tabId]: outline }));
    }

    const current = tabs.find((tab) => tab.id === tabId)?.currentPage ?? 1;
    if (current > safePages) {
      onTabUpdate(tabId, { currentPage: safePages });
    }
  }, [onTabUpdate, tabs]);

  const handlePageChangeForTab = useCallback((tabId: string, page: number) => {
    const targetTab = tabs.find((tab) => tab.id === tabId);
    if (!targetTab) {
      return;
    }

    const pageLimit = tabPageCounts[tabId] && tabPageCounts[tabId] > 0 ? tabPageCounts[tabId] : 1;
    const nextPage = Math.max(1, Math.min(page, pageLimit));

    if (nextPage !== targetTab.currentPage) {
      onTabUpdate(tabId, { currentPage: nextPage });
    }
  }, [onTabUpdate, tabPageCounts, tabs]);

  const handlePageChange = useCallback((page: number) => {
    if (!activeTab) {
      return;
    }
    handlePageChangeForTab(activeTab.id, page);
  }, [activeTab, handlePageChangeForTab]);

  const handlePrevPage = useCallback(() => {
    if (!activeTab) {
      return;
    }

    handlePageChange(activeTab.currentPage - 1);
  }, [activeTab, handlePageChange]);

  const handleNextPage = useCallback(() => {
    if (!activeTab) {
      return;
    }

    handlePageChange(activeTab.currentPage + 1);
  }, [activeTab, handlePageChange]);

  const handleZoomIn = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const nextScale = Math.min(activeTab.scale + SCALE_STEP, MAX_SCALE);
    if (activeTab.zoomMode === 'fit_width') {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
      return;
    }

    if (nextScale !== activeTab.scale) {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
    }
  }, [activeTab, onTabUpdate]);

  const handleZoomOut = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const nextScale = Math.max(activeTab.scale - SCALE_STEP, MIN_SCALE);
    if (activeTab.zoomMode === 'fit_width') {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
      return;
    }

    if (nextScale !== activeTab.scale) {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: nextScale });
    }
  }, [activeTab, onTabUpdate]);

  const handleResetZoom = useCallback(() => {
    if (!activeTab) {
      return;
    }

    if (activeTab.zoomMode !== 'custom' || activeTab.scale !== 1) {
      onTabUpdate(activeTab.id, { zoomMode: 'custom', scale: 1 });
    }
  }, [activeTab, onTabUpdate]);

  const handleAddHighlight = useCallback((
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => {
    const annotation = addHighlight(page, selectedText, color, rects);
    setShowAnnotations(true);
    setSelectedAnnotationId(annotation.id);
  }, [addHighlight]);

  const handleAddUnderline = useCallback((
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => {
    const annotation = addUnderline(page, selectedText, color, rects);
    setShowAnnotations(true);
    setSelectedAnnotationId(annotation.id);
  }, [addUnderline]);

  const handleAnnotationPageChange = useCallback((page: number) => {
    handlePageChange(page);
  }, [handlePageChange]);

  const handleHighlightClick = useCallback((annotation: Annotation, context?: AnnotationClickContext) => {
    if (eraseMode) {
      deleteAnnotation(annotation.id);
      if (selectedAnnotationId === annotation.id) {
        setSelectedAnnotationId(null);
      }
      return;
    }
    setShowAnnotations(true);
    setSelectedAnnotationId(annotation.id);
    handlePageChange(annotation.page);
    triggerAnnotationFocusGuide(annotation.id, context);
  }, [deleteAnnotation, eraseMode, handlePageChange, selectedAnnotationId, triggerAnnotationFocusGuide]);

  const handleDeleteAnnotation = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId);
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(null);
    }
  }, [deleteAnnotation, selectedAnnotationId]);

  const handleDocumentReady = useCallback((tabId: string, doc: PDFDocumentProxy | null) => {
    if (doc) {
      tabDocRefs.current.set(tabId, doc);
    } else {
      tabDocRefs.current.delete(tabId);
    }
  }, []);

  const getAiErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof AiServiceError) {
      if (error.code === 'AUTH_INVALID') return 'OpenRouter API Key 无效，请检查设置。';
      if (error.code === 'RATE_LIMIT') return 'OpenRouter 触发限流，请稍后重试。';
      if (error.code === 'NETWORK_ERROR') return '网络请求失败，请检查网络连接。';
      if (error.code === 'ABORTED') return '请求已取消。';
      if (error.code === 'INVALID_CONFIG') return '请先在设置中填写 OpenRouter API Key 和模型。';
      return error.message || 'AI 请求失败。';
    }
    return error instanceof Error ? error.message : 'AI 请求失败。';
  }, []);

  const validateAiConfig = useCallback((): string | null => {
    if (!aiConfig.enabled) return 'AI 功能当前已关闭，请在设置中启用。';
    if (!aiConfig.apiKey.trim()) return '请先在设置中配置 OpenRouter API Key。';
    if (!aiConfig.model.trim()) return '请先在设置中配置 OpenRouter 模型。';
    return null;
  }, [aiConfig]);

  const handleSummarizePage = useCallback(async () => {
    if (!activeTab) return;
    const doc = tabDocRefs.current.get(activeTab.id);
    if (!doc) return;

    const configError = validateAiConfig();
    if (configError) {
      setSummaryState({ open: true, title: 'AI 总结当前页', content: '', status: 'error', error: configError, warning: null, truncated: false, mode: 'page' });
      return;
    }

    summaryStopRef.current = false;
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    const warning = aiConfig.todayRequestCount >= aiConfig.dailyUsageSoftLimit
      ? `今日调用已达到 ${aiConfig.todayRequestCount} 次，超过提醒阈值 ${aiConfig.dailyUsageSoftLimit}。`
      : null;

    setSummaryState({ open: true, title: 'AI 总结当前页', content: '', status: 'loading', error: null, warning, truncated: false, mode: 'page' });

    try {
      const pageText = await extractPageText(doc, activeTab.currentPage);
      if (!pageText.trim()) {
        setSummaryState((prev) => ({ ...prev, status: 'error', error: '当前页没有可提取的文本。' }));
        return;
      }

      await streamOpenRouterChatCompletion({
        apiKey: aiConfig.apiKey.trim(),
        model: aiConfig.model.trim(),
        reasoningEnabled: aiConfig.reasoningEnabled,
        messages: [
          { role: 'system', content: '你是一个严谨的中文学术阅读助手。请对用户给出的文本做精炼的段落式摘要，语言简洁连贯，不要使用列表或要点形式，不要编造未出现的信息。' },
          { role: 'user', content: `请总结下面这页的内容（第 ${activeTab.currentPage} 页）：\n\n${pageText}` },
        ],
        signal: controller.signal,
        onDelta: (chunk) => {
          setSummaryState((prev) => ({ ...prev, status: 'streaming', content: prev.content + chunk }));
        },
      });
      setSummaryState((prev) => ({ ...prev, status: 'done' }));
      onAiRequestFinished?.(true);
    } catch (error) {
      if (error instanceof AiServiceError && error.code === 'ABORTED') {
        if (summaryStopRef.current) {
          summaryStopRef.current = false;
          setSummaryState((prev) => ({ ...prev, status: 'done' }));
        } else {
          setSummaryState((prev) => ({ ...prev, status: 'idle', open: false }));
        }
        return;
      }
      setSummaryState((prev) => ({ ...prev, status: 'error', error: getAiErrorMessage(error) }));
      onAiRequestFinished?.(false);
    } finally {
      if (summaryAbortRef.current === controller) summaryAbortRef.current = null;
    }
  }, [activeTab, aiConfig, getAiErrorMessage, onAiRequestFinished, validateAiConfig]);

  const handleSummarizeDocument = useCallback(async () => {
    if (!activeTab) return;
    const doc = tabDocRefs.current.get(activeTab.id);
    if (!doc) return;

    const configError = validateAiConfig();
    if (configError) {
      setSummaryState({ open: true, title: 'AI 总结全文', content: '', status: 'error', error: configError, warning: null, truncated: false, mode: 'doc' });
      return;
    }

    summaryStopRef.current = false;
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    const warning = aiConfig.todayRequestCount >= aiConfig.dailyUsageSoftLimit
      ? `今日调用已达到 ${aiConfig.todayRequestCount} 次，超过提醒阈值 ${aiConfig.dailyUsageSoftLimit}。`
      : null;

    setSummaryState({ open: true, title: 'AI 总结全文', content: '', status: 'loading', error: null, warning, truncated: false, mode: 'doc' });

    try {
      const { text: docText, truncated } = await extractDocumentText(doc, { maxChars: 80_000 });
      if (!docText.trim()) {
        setSummaryState((prev) => ({ ...prev, status: 'error', error: '文档没有可提取的文本。' }));
        return;
      }

      setSummaryState((prev) => ({ ...prev, truncated }));

      await streamOpenRouterChatCompletion({
        apiKey: aiConfig.apiKey.trim(),
        model: aiConfig.model.trim(),
        reasoningEnabled: aiConfig.reasoningEnabled,
        messages: [
          { role: 'system', content: '你是一个严谨的中文学术阅读助手。请对用户给出的文档内容做精炼的段落式摘要，语言简洁连贯，不要使用列表或要点形式，不要编造未出现的信息。' },
          { role: 'user', content: `请总结下面这篇文档的内容：\n\n${docText}` },
        ],
        signal: controller.signal,
        onDelta: (chunk) => {
          setSummaryState((prev) => ({ ...prev, status: 'streaming', content: prev.content + chunk }));
        },
      });
      setSummaryState((prev) => ({ ...prev, status: 'done' }));
      onAiRequestFinished?.(true);
    } catch (error) {
      if (error instanceof AiServiceError && error.code === 'ABORTED') {
        if (summaryStopRef.current) {
          summaryStopRef.current = false;
          setSummaryState((prev) => ({ ...prev, status: 'done' }));
        } else {
          setSummaryState((prev) => ({ ...prev, status: 'idle', open: false }));
        }
        return;
      }
      setSummaryState((prev) => ({ ...prev, status: 'error', error: getAiErrorMessage(error) }));
      onAiRequestFinished?.(false);
    } finally {
      if (summaryAbortRef.current === controller) summaryAbortRef.current = null;
    }
  }, [activeTab, aiConfig, getAiErrorMessage, onAiRequestFinished, validateAiConfig]);

  const handleCloseSummary = useCallback(() => {
    summaryAbortRef.current?.abort();
    summaryAbortRef.current = null;
    setSummaryState((prev) => ({ ...prev, open: false, status: 'idle' }));
  }, []);

  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!activeTab) return;
    const doc = tabDocRefs.current.get(activeTab.id);
    if (!doc) return;

    const configError = validateAiConfig();
    if (configError) {
      const errorMsg: ChatMessage = { id: `err-${Date.now()}`, role: 'assistant', content: configError };
      setChatMessages((prev) => [...prev, errorMsg]);
      return;
    }

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: message };
    const assistantMsg: ChatMessage = { id: `asst-${Date.now()}`, role: 'assistant', content: '' };
    setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatStreaming(true);

    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const pageText = await extractPageText(doc, activeTab.currentPage);
      const contextMessages = chatMessages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      await streamOpenRouterChatCompletion({
        apiKey: aiConfig.apiKey.trim(),
        model: aiConfig.model.trim(),
        reasoningEnabled: aiConfig.reasoningEnabled,
        messages: [
          { role: 'system', content: `你是一个严谨的中文学术阅读助手。用户正在阅读一篇 PDF 文档。以下是当前页（第 ${activeTab.currentPage} 页）的文本内容，请基于此回答用户的问题。若信息不足，请明确说明。\n\n当前页内容：\n${pageText}` },
          ...contextMessages,
          { role: 'user', content: message },
        ],
        signal: controller.signal,
        onDelta: (chunk) => {
          setChatMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + chunk };
            }
            return updated;
          });
        },
      });
      onAiRequestFinished?.(true);
    } catch (error) {
      if (error instanceof AiServiceError && error.code === 'ABORTED') {
        return;
      }
      const errText = getAiErrorMessage(error);
      setChatMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { ...last, content: `错误：${errText}` };
        }
        return updated;
      });
      onAiRequestFinished?.(false);
    } finally {
      setChatStreaming(false);
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
    }
  }, [activeTab, aiConfig, chatMessages, getAiErrorMessage, onAiRequestFinished, validateAiConfig]);

  const handleToggleChat = useCallback(() => {
    setShowChat((prev) => {
      if (!prev) setShowAnnotations(false);
      return !prev;
    });
  }, []);

  const handleToggleAnnotations = useCallback(() => {
    setShowAnnotations((prev) => {
      if (!prev) setShowChat(false);
      return !prev;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTab) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+F: open search (always intercept, even in inputs)
      if (isMod && e.key === 'f') {
        e.preventDefault();
        openSearch();
        return;
      }

      // Cmd/Ctrl+G: focus page input for quick jump
      if (isMod && e.key === 'g') {
        e.preventDefault();
        pageInputRef.current?.focus();
        pageInputRef.current?.select();
        return;
      }

      // ESC: close search first, then other panels
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          e.preventDefault();
          closeSearch();
          return;
        }
        return;
      }

      // Skip remaining shortcuts when focused on input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const totalPages = tabPageCounts[activeTab.id] ?? 0;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handlePageChange(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (totalPages > 0) handlePageChange(totalPages);
      } else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollBy({ top: container.clientHeight * 0.85, behavior: 'smooth' });
        }
      } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollBy({ top: -container.clientHeight * 0.85, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut, handleResetZoom, handlePageChange, tabPageCounts, isSearchOpen, openSearch, closeSearch]);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 archive-shell-bg archive-library">
        <div className="h-14 border-b border-black/10 border-dashed bg-white/40 flex items-center px-4">
          <span className="font-medium text-[var(--archive-ink-black)]">PDF Reader</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-white rounded-full border border-black/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[var(--archive-ink-grey)]" />
            </div>
            <p className="text-[var(--archive-ink-black)] mb-2">没有打开的文件</p>
            <p className="text-sm text-[var(--archive-ink-grey)]">拖拽 PDF 文件到窗口，或点击打开文件</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 archive-shell-bg archive-library">
      <div className="bg-white/45 border-b border-black/10 border-dashed flex items-center overflow-x-auto backdrop-blur-[1px]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 min-w-[120px] max-w-[220px]
                border-r border-black/10 cursor-pointer select-none
                transition-colors group relative
                ${isActive
                  ? 'bg-white/80 text-[var(--archive-ink-black)]'
                  : 'bg-transparent text-[var(--archive-ink-grey)] hover:bg-white/35'}
              `}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--archive-rust)]" />
              )}

              <FileText className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate flex-1" title={tab.fileName}>
                {tab.fileName}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {activeTab && (
        <>
          <ReaderToolbar
            scale={activeTab.scale}
            canZoomIn={activeTab.scale < MAX_SCALE}
            canZoomOut={activeTab.scale > MIN_SCALE}
            showContents={isSidebarOpen}
            showAnnotations={showAnnotations}
            eraseMode={eraseMode}
            showChat={showChat}
            currentPage={activeTab.currentPage}
            totalPages={tabPageCounts[activeTab.id] ?? 0}
            onPageChange={handlePageChange}
            onToggleContents={() => setIsSidebarOpen((prev) => !prev)}
            onToggleAnnotations={handleToggleAnnotations}
            onToggleEraseMode={() => setEraseMode((prev) => !prev)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onSummarizePage={() => { void handleSummarizePage(); }}
            onSummarizeDocument={() => { void handleSummarizeDocument(); }}
            onToggleChat={handleToggleChat}
            pageInputRef={pageInputRef}
          />

          <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
            <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden">
              {tabs
                .filter((tab) => mountedTabIds.includes(tab.id))
                .map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const tabAnnotations = tab.annotationKey === fileId ? annotations : [];
                  const tabTotalPages = tabPageCounts[tab.id] ?? 0;
                  return (
                    <div
                      key={tab.id}
                      className={`${isActive ? 'flex' : 'hidden'} h-full min-h-0 min-w-0 overflow-hidden`}
                    >
                      {isSidebarOpen && (
                        <ReaderSidebar
                          file={tab.file}
                          currentPage={tab.currentPage}
                          totalPages={tabTotalPages}
                          onPageChange={(page) => handlePageChangeForTab(tab.id, page)}
                          onBack={() => onTabClose(tab.id)}
                          sidebarTab={sidebarTab}
                          onSidebarTabChange={setSidebarTab}
                          outline={tabOutlines[tab.id] ?? []}
                        />
                      )}

                      <div className="flex-1 relative min-h-0 min-w-0">
                        <PdfViewer
                          file={tab.file}
                          currentPage={tab.currentPage}
                          scale={tab.scale}
                          fitWidthMode={tab.zoomMode === 'fit_width'}
                          onFitWidthScaleCalculated={(nextScale) => {
                            if (!isActive || tab.zoomMode !== 'fit_width') {
                              return;
                            }
                            if (Math.abs(nextScale - tab.scale) <= 0.01) {
                              return;
                            }
                            onTabUpdate(tab.id, { scale: nextScale });
                          }}
                          annotations={tabAnnotations}
                          onDocumentLoad={(pages, outline) => handleDocumentLoad(tab.id, pages, outline)}
                          onPageChange={(page) => handlePageChangeForTab(tab.id, page)}
                          onAddHighlight={handleAddHighlight}
                          onAddUnderline={handleAddUnderline}
                          onHighlightClick={handleHighlightClick}
                          interactiveHighlights={false}
                          deleteMode={eraseMode}
                          isActive={isActive}
                          aiConfig={aiConfig}
                          onAiRequestFinished={onAiRequestFinished}
                          onDocumentReady={(doc) => handleDocumentReady(tab.id, doc)}
                          scrollContainerRef={isActive ? scrollContainerRef : undefined}
                          searchQuery={isActive ? searchQuery : undefined}
                          searchActiveMatch={
                            isActive && searchMatchIndex >= 0 && searchMatches[searchMatchIndex]
                              ? searchMatches[searchMatchIndex]
                              : undefined
                          }
                        />
                        {isActive && isSearchOpen && (
                          <SearchBar
                            query={searchQuery}
                            onSearch={doSearch}
                            onNext={nextMatch}
                            onPrev={prevMatch}
                            onClose={closeSearch}
                            currentMatch={searchMatchIndex}
                            totalMatches={searchMatches.length}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {showAnnotations && !showChat && activeTab && (
              <div
                ref={annotationPanelRef}
                className={`w-80 bg-white/85 border-l border-black/10 border-dashed flex flex-col backdrop-blur-[1px] ${
                  panelAttention ? 'archive-annotation-panel-guided' : ''
                }`}
              >
                <div className="px-4 py-3 border-b border-black/10 border-dashed flex items-center justify-between gap-2">
                  <h3 className="font-medium text-[var(--archive-ink-black)] uppercase tracking-[0.06em] text-xs">批注</h3>
                  <button
                    type="button"
                    onClick={() => setShowAnnotations(false)}
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-black/10 text-[var(--archive-ink-grey)] transition-colors hover:bg-white hover:text-[var(--archive-ink-black)]"
                    title="收起批注面板"
                    aria-label="收起批注面板"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <AnnotationPanel
                  annotations={getAllAnnotations()}
                  currentPage={activeTab.currentPage}
                  onPageChange={handleAnnotationPageChange}
                  onDelete={handleDeleteAnnotation}
                  onUpdateComment={updateComment}
                  selectedAnnotationId={selectedAnnotationId}
                  attentionAnnotationId={attentionAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                />
              </div>
            )}

            {showChat && !showAnnotations && activeTab && (
              <ChatPanel
                messages={chatMessages}
                isStreaming={chatStreaming}
                onSend={(msg) => { void handleSendChatMessage(msg); }}
                onClose={() => setShowChat(false)}
              />
            )}
          </div>

          {summaryState.open && (
            <AiResultPanel
              title={summaryState.title}
              content={summaryState.content}
              status={summaryState.status}
              error={summaryState.error}
              warning={summaryState.warning}
              truncated={summaryState.truncated}
              onClose={handleCloseSummary}
              onCopy={() => { void navigator.clipboard.writeText(summaryState.content); }}
              onRetry={() => {
                if (summaryState.mode === 'page') {
                  void handleSummarizePage();
                } else {
                  void handleSummarizeDocument();
                }
              }}
              onStop={() => { summaryStopRef.current = true; summaryAbortRef.current?.abort(); }}
            />
          )}

          {(focusGuide || focusOrigin) && (
            <div className="archive-focus-overlay" aria-hidden>
              {focusOrigin && (
                <span
                  className="archive-focus-origin-pulse"
                  style={{ left: focusOrigin.x, top: focusOrigin.y }}
                />
              )}
              <svg
                className="archive-focus-svg"
                viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
                preserveAspectRatio="none"
              >
                {focusGuide && focusGuidePath && (
                  <>
                    <path d={focusGuidePath} pathLength={1} className="archive-focus-bridge-line" />
                    <circle
                      className="archive-focus-target-dot"
                      cx={focusGuide.target.x}
                      cy={focusGuide.target.y}
                      r={7}
                    />
                  </>
                )}
              </svg>
            </div>
          )}
        </>
      )}
    </div>
  );
}
