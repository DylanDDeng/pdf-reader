import { useState, useCallback, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSidebar } from './ReaderSidebar';
import { FloatingToolbar } from './FloatingToolbar';
import { PdfViewer } from './PdfViewer';
import { AnnotationPanel } from './AnnotationPanel';
import type { OutlineItem } from '../../utils/pdf';
import type { Tab } from '../../hooks/useTabs';

import { useAnnotations } from '../../hooks/useAnnotations';

interface ViewerProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onOpenFile?: (file: File | string) => void;
}

export function Viewer({ 
  tabs, 
  activeTabId, 
  onTabChange, 
  onTabClose,
}: ViewerProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [isSidebarOpen] = useState(true);
  const [showAnnotations] = useState(false);

  // 获取当前激活的标签页
  const activeTab = tabs.find(t => t.id === activeTabId) || null;

  // 使用文件路径作为 annotations 的 key
  const fileId = activeTab ? (typeof activeTab.file === 'string' ? activeTab.file : activeTab.file.name) : null;
  const {
    annotations,
    addHighlight,
    deleteAnnotation,
    updateComment,
    getAllAnnotations,
  } = useAnnotations(fileId);

  // 处理文档加载
  const handleDocumentLoad = useCallback((pages: number, pdfOutline: OutlineItem[]) => {
    setTotalPages(pages);
    setOutline(pdfOutline);
  }, []);

  // 处理页面变化
  const handlePageChange = useCallback((_page: number) => {
    // 这里需要通知父组件更新 tab 的 currentPage
    // 暂时先不做状态同步，只在 PdfViewer 内部处理
  }, []);

  // 处理缩放
  const handleZoomIn = useCallback(() => {
    // 同上，需要通知父组件
  }, []);

  const handleZoomOut = useCallback(() => {
    // 同上，需要通知父组件
  }, []);

  // 处理高亮添加
  const handleAddHighlight = useCallback((
    page: number, 
    selectedText: string, 
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => {
    addHighlight(page, selectedText, 'yellow', rects);
  }, [addHighlight]);

  // 处理批注点击跳转
  const handleAnnotationPageChange = useCallback((_page: number) => {
    // 需要通知 PdfViewer 跳转页面
    // 这个需要通过 ref 或状态提升来实现
  }, []);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTab) return;
      
      // 避免在输入框中时触发
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        // 上一页
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        // 下一页
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // 如果没有打开的文件，显示空状态
  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-[#f6f7f8]">
        <div className="h-14 border-b border-slate-200 bg-white flex items-center px-4">
          <span className="font-medium text-slate-700">PDF Reader</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 mb-2">没有打开的文件</p>
            <p className="text-sm text-slate-400">拖拽 PDF 文件到窗口，或点击打开文件</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#f6f7f8]">
      {/* 标签页栏 */}
      <div className="bg-white border-b border-slate-200 flex items-center overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 min-w-[120px] max-w-[200px] 
                border-r border-slate-200 cursor-pointer select-none
                transition-colors group relative
                ${isActive 
                  ? 'bg-white text-slate-800' 
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }
              `}
            >
              {/* 激活指示器 */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
              
              <FileText className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate flex-1">{tab.fileName}</span>
              
              {/* 关闭按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className={`
                  w-5 h-5 rounded flex items-center justify-center
                  opacity-0 group-hover:opacity-100 transition-opacity
                  ${isActive ? 'hover:bg-slate-200' : 'hover:bg-slate-200'}
                `}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 主内容区域 */}
      {activeTab && (
        <>
          {/* 顶部工具栏 */}
          <ReaderToolbar
            fileName={activeTab.fileName}
            scale={activeTab.scale}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onClose={() => onTabClose(activeTab.id)}
          />

          {/* 主要内容 */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧边栏 - 目录 */}
            {isSidebarOpen && (
              <ReaderSidebar
                outline={outline}
                currentPage={activeTab.currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}

            {/* 中间 - PDF 阅读器 */}
            <div className="flex-1 relative">
              <PdfViewer
                file={activeTab.file}
                currentPage={activeTab.currentPage}
                scale={activeTab.scale}
                annotations={annotations}
                onDocumentLoad={handleDocumentLoad}
                onAddHighlight={handleAddHighlight}
              />
              
              {/* 浮动工具栏 */}
              <FloatingToolbar
                currentPage={activeTab.currentPage}
                totalPages={totalPages}
                onPrevPage={() => {}}
                onNextPage={() => {}}
              />
            </div>

            {/* 右侧边栏 - 批注列表 */}
            {showAnnotations && (
              <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h3 className="font-medium text-slate-800">批注</h3>
                </div>
                <AnnotationPanel
                  annotations={getAllAnnotations()}
                  currentPage={activeTab.currentPage}
                  onPageChange={handleAnnotationPageChange}
                  onDelete={deleteAnnotation}
                  onUpdateComment={updateComment}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
