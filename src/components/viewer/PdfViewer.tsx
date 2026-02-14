import { useEffect, useRef, useCallback, useState } from 'react';
import { loadPdfDocument, renderPage, extractOutline, type OutlineItem, getTextContent, type TextItem } from '../../utils/pdf';
import { HighlightLayer } from './HighlightLayer';
import { SelectionToolbar, type AnnotationAction } from './SelectionToolbar';
import type { Annotation, HighlightColor } from '../../types/annotation';

interface PdfViewerProps {
  file: File | string;
  currentPage: number;
  scale: number;
  annotations: Annotation[];
  onDocumentLoad: (totalPages: number, outline: OutlineItem[]) => void;
  onAddHighlight: (page: number, selectedText: string, rects: Array<{ left: number; top: number; width: number; height: number }>) => void;
}

export function PdfViewer({
  file,
  currentPage,
  scale,
  annotations,
  onDocumentLoad,
  onAddHighlight,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<any>(null);
  const documentRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  
  // 选中文本相关状态
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectedRects, setSelectedRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  
  // 用于防止选择事件重复触发
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const renderCurrentPage = useCallback(async () => {
    if (!documentRef.current || !canvasRef.current || !textLayerRef.current) {
      return;
    }

    try {
      const page = await documentRef.current.getPage(currentPage);
      pageRef.current = page;
      
      const viewport = page.getViewport({ scale });
      setPageSize({ width: viewport.width, height: viewport.height });
      
      // Render canvas
      await renderPage(page, canvasRef.current, scale);
      
      // Render text layer
      await renderTextLayer(page, textLayerRef.current, scale);
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }, [currentPage, scale]);

  const renderTextLayer = async (page: any, container: HTMLDivElement, scale: number) => {
    const viewport = page.getViewport({ scale });
    
    // Clear previous content
    container.innerHTML = '';
    container.style.width = `${viewport.width}px`;
    container.style.height = `${viewport.height}px`;
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    // 关键：确保文本层可交互
    container.style.cursor = 'text';
    container.style.userSelect = 'text';

    try {
      const textContent = await getTextContent(page);
      
      // 创建文本片段容器
      const textItems = textContent.items as TextItem[];
      
      // 按行分组文本项（根据 Y 坐标）
      const lineMap = new Map<number, TextItem[]>();
      const tolerance = 2; // Y 坐标容差
      
      textItems.forEach((item) => {
        const y = item.transform[5];
        // 找到接近的 Y 坐标
        let foundY: number | null = null;
        for (const [key] of lineMap) {
          if (Math.abs(key - y) < tolerance) {
            foundY = key;
            break;
          }
        }
        
        if (foundY !== null) {
          lineMap.get(foundY)!.push(item);
        } else {
          lineMap.set(y, [item]);
        }
      });
      
      // 为每行创建一个容器
      lineMap.forEach((items, y) => {
        // 按 X 坐标排序
        items.sort((a, b) => a.transform[4] - b.transform[4]);
        
        // 创建行容器
        const lineDiv = document.createElement('div');
        lineDiv.style.position = 'absolute';
        lineDiv.style.left = '0';
        lineDiv.style.top = `${viewport.height - y * scale - items[0].height * scale}px`;
        lineDiv.style.height = `${items[0].height * scale}px`;
        lineDiv.style.whiteSpace = 'nowrap';
        
        // 创建文本 span
        items.forEach((item) => {
          const span = document.createElement('span');
          span.textContent = item.str;
          span.style.position = 'absolute';
          span.style.left = `${item.transform[4] * scale}px`;
          span.style.top = '0';
          span.style.fontSize = `${item.height * scale}px`;
          span.style.fontFamily = item.fontName || 'sans-serif';
          span.style.lineHeight = '1';
          span.style.color = 'transparent';
          span.style.userSelect = 'text';
          span.style.webkitUserSelect = 'text';
          span.style.cursor = 'text';
          
          lineDiv.appendChild(span);
        });
        
        container.appendChild(lineDiv);
      });
    } catch (err) {
      console.error('Error rendering text layer:', err);
    }
  };

  // Load document
  useEffect(() => {
    let isMounted = true;

    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
      // 清除之前的选择状态
      setToolbarPosition(null);
      setSelectedText('');
      setSelectedRects([]);
      
      try {
        let source: ArrayBuffer;

        if (typeof file === 'string') {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const contents = await readFile(file);
          source = new Uint8Array(contents).buffer as ArrayBuffer;
        } else {
          source = await file.arrayBuffer();
        }

        const doc = await loadPdfDocument(source);

        if (isMounted) {
          documentRef.current = doc;
          
          // Extract outline from PDF
          const outline = await extractOutline(doc);
          onDocumentLoad(doc.numPages, outline);

          if (canvasRef.current && textLayerRef.current) {
            const page = await doc.getPage(1);
            const viewport = page.getViewport({ scale });
            setPageSize({ width: viewport.width, height: viewport.height });
            
            await renderPage(page, canvasRef.current, scale);
            await renderTextLayer(page, textLayerRef.current, scale);
          }
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(`Failed to load PDF: ${errorMessage}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
      if (documentRef.current) {
        documentRef.current.destroy();
        documentRef.current = null;
      }
    };
  }, [file, onDocumentLoad]);

  // Render page when current page or scale changes
  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // 检查选择是否在文本层内
  const isSelectionInTextLayer = useCallback((selection: Selection): boolean => {
    const textLayer = textLayerRef.current;
    if (!textLayer || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    // 检查选区的起始和结束是否在文本层内
    const checkNode = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) {
        return textLayer.contains(node);
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        return textLayer.contains(node);
      }
      return false;
    };

    // 检查 anchorNode 和 focusNode
    const anchorInLayer = checkNode(range.startContainer);
    const focusInLayer = checkNode(range.endContainer);

    return anchorInLayer || focusInLayer;
  }, []);

  // 获取选中文本的信息
  const getSelectionInfo = useCallback((selection: Selection): { text: string; rects: Array<{ left: number; top: number; width: number; height: number }>; mousePosition: { x: number; y: number } } | null => {
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return null;
    }

    const textLayer = textLayerRef.current;
    if (!textLayer) return null;

    const containerRect = textLayer.getBoundingClientRect();
    const range = selection.getRangeAt(0);
    const rectList = range.getClientRects();
    
    if (rectList.length === 0) return null;

    const rects: Array<{ left: number; top: number; width: number; height: number }> = [];
    
    for (let i = 0; i < rectList.length; i++) {
      const rect = rectList[i];
      rects.push({
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      });
    }

    // 获取鼠标位置（使用选区的最后一个矩形中心）
    const lastRect = rectList[rectList.length - 1];
    const mousePosition = {
      x: lastRect.left + lastRect.width / 2,
      y: lastRect.top,
    };

    return {
      text: selection.toString().trim(),
      rects,
      mousePosition,
    };
  }, []);

  // 处理选择变化
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    
    console.log('Selection changed:', {
      selection: selection?.toString(),
      isCollapsed: selection?.isCollapsed,
      rangeCount: selection?.rangeCount,
    });

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    // 检查选择是否在文本层内
    if (!isSelectionInTextLayer(selection)) {
      console.log('Selection not in text layer');
      return;
    }

    console.log('Selection in text layer, processing...');

    // 使用 setTimeout 确保选择完成
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    selectionTimeoutRef.current = setTimeout(() => {
      const info = getSelectionInfo(selection);
      console.log('Selection info:', info);
      
      if (info && info.text.length > 0) {
        setSelectedText(info.text);
        setSelectedRects(info.rects);
        setToolbarPosition(info.mousePosition);
        console.log('Toolbar should show at:', info.mousePosition);
      }
    }, 10);
  }, [isSelectionInTextLayer, getSelectionInfo]);

  // 监听选择变化
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [handleSelectionChange]);

  // 处理高亮操作
  const handleToolbarAction = (action: AnnotationAction) => {
    if (action === 'highlight' && selectedText && selectedRects.length > 0) {
      // 调整 rects 为相对于页面的比例（考虑当前 scale）
      const scaledRects = selectedRects.map(rect => ({
        left: rect.left / scale,
        top: rect.top / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      }));
      
      onAddHighlight(currentPage, selectedText, scaledRects);
      
      // 清除选择
      window.getSelection()?.removeAllRanges();
      setToolbarPosition(null);
      setSelectedText('');
      setSelectedRects([]);
    }
  };

  const handleCloseToolbar = () => {
    window.getSelection()?.removeAllRanges();
    setToolbarPosition(null);
    setSelectedText('');
    setSelectedRects([]);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#eef0f2] relative flex justify-center p-8"
    >
      {/* PDF Page Container */}
      <div className="relative">
        {/* Page Card */}
        <div 
          className="bg-white rounded-lg shadow-xl overflow-hidden relative"
          style={{ width: pageSize.width, height: pageSize.height }}
        >
          {isLoading && (
            <div className="flex items-center justify-center w-full h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-slate-400">Loading...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center w-full h-full p-8">
              <div className="text-red-500 text-center">
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}
          
          {/* Canvas Layer */}
          <canvas
            ref={canvasRef}
            className="block absolute top-0 left-0"
            style={{
              display: isLoading || error ? 'none' : 'block',
            }}
          />
          
          {/* Text Layer - for selection */}
          <div
            ref={textLayerRef}
            className="absolute top-0 left-0"
            style={{
              display: isLoading || error ? 'none' : 'block',
            }}
          />

          {/* Highlight Layer */}
          {!isLoading && !error && (
            <HighlightLayer
              annotations={annotations}
              page={currentPage}
              scale={scale}
              pageWidth={pageSize.width}
              pageHeight={pageSize.height}
            />
          )}
        </div>

        {/* Page Number Indicator - Top Right */}
        <div className="absolute -top-6 right-0 text-xs text-slate-400 font-medium">
          {currentPage.toString().padStart(2, '0')}
        </div>
      </div>

      {/* Selection Toolbar */}
      {toolbarPosition && (
        <SelectionToolbar
          position={toolbarPosition}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
          onAction={handleToolbarAction}
          onClose={handleCloseToolbar}
        />
      )}
    </div>
  );
}
