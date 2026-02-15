export type AnnotationType = 'highlight' | 'underline' | 'comment' | 'bookmark';

export const HIGHLIGHT_COLORS = {
  yellow: { bg: 'rgba(250, 204, 21, 0.32)', border: '#facc15', name: '黄色' },
  green: { bg: 'rgba(74, 222, 128, 0.30)', border: '#4ade80', name: '绿色' },
  red: { bg: 'rgba(248, 113, 113, 0.28)', border: '#f87171', name: '红色' },
  blue: { bg: 'rgba(96, 165, 250, 0.30)', border: '#60a5fa', name: '蓝色' },
  purple: { bg: 'rgba(192, 132, 252, 0.30)', border: '#c084fc', name: '紫色' },
};

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

export interface Annotation {
  id: string;
  type: AnnotationType;
  page: number;
  
  // 选中的文本内容
  selectedText: string;
  
  // 高亮颜色
  color: HighlightColor;
  
  // 用户批注
  comment?: string;
  
  // 位置信息（相对于页面的百分比，用于重新渲染）
  rects: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
  
  // 创建时间
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationStore {
  // key: filePath or fileId
  [key: string]: Annotation[];
}
