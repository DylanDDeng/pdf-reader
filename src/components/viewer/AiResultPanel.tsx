import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiResultPanelProps {
  title: string;
  content: string;
  status: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
  error: string | null;
  warning: string | null;
  question?: string;
  truncated?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onRetry: () => void;
  onStop?: () => void;
}

export function AiResultPanel({
  title,
  content,
  status,
  error,
  warning,
  question,
  truncated,
  onClose,
  onCopy,
  onRetry,
  onStop,
}: AiResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (content) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content]);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isGenerating = status === 'loading' || status === 'streaming';

  return (
    <div className="fixed z-[55] right-5 bottom-5 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 bg-white shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-black/10 bg-black/[0.03]">
        <div className="text-xs font-semibold tracking-wide uppercase text-[var(--archive-ink-black)]">
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-black/5 text-[var(--archive-ink-grey)]"
          title="关闭 AI 结果"
          aria-label="关闭 AI 结果"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-2 max-h-[46vh] overflow-auto text-sm leading-6 text-[var(--archive-ink-black)]">
        {warning && (
          <div className="mb-2 rounded-md border border-amber-300/70 bg-amber-50 px-2 py-1 text-xs text-amber-700">
            {warning}
          </div>
        )}
        {question && (
          <div className="mb-2 text-xs text-[var(--archive-ink-grey)]">
            问题：{question}
          </div>
        )}
        {isGenerating && content.length === 0 && (
          <div className="flex items-center gap-1 text-[var(--archive-ink-grey)]">
            <span>AI 正在思考</span>
            <span className="ai-loading-dots">
              <span className="ai-loading-dot" />
              <span className="ai-loading-dot" />
              <span className="ai-loading-dot" />
            </span>
          </div>
        )}
        {content && (
          <div className="ai-markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {truncated && (
          <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
            文档内容过长，已截断部分文本进行摘要。
          </div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-black/10 bg-black/[0.02]">
        <button
          type="button"
          onClick={handleCopy}
          className="archive-action-btn !h-8 !px-3 text-xs"
          disabled={!content}
        >
          {copied ? '已复制' : '复制结果'}
        </button>
        {isGenerating && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="archive-action-btn archive-action-btn-primary !h-8 !px-3 text-xs"
          >
            停止生成
          </button>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="archive-action-btn archive-action-btn-primary !h-8 !px-3 text-xs"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
