import { useState, useRef, useEffect } from 'react';
import { Send, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../types/ai';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  onClose: () => void;
}

export function ChatPanel({ messages, isStreaming, onSend, onClose }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-80 bg-white/85 border-l border-black/10 border-dashed flex flex-col backdrop-blur-[1px]">
      <div className="px-4 py-3 border-b border-black/10 border-dashed flex items-center justify-between gap-2">
        <h3 className="font-medium text-[var(--archive-ink-black)] uppercase tracking-[0.06em] text-xs">Chat</h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-black/10 text-[var(--archive-ink-grey)] transition-colors hover:bg-white hover:text-[var(--archive-ink-black)]"
          title="关闭聊天"
          aria-label="关闭聊天"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-[var(--archive-ink-grey)] py-8">
            向 AI 提问关于这篇文档的问题
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm leading-6 ${
              msg.role === 'user'
                ? 'bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 ml-6 whitespace-pre-wrap'
                : 'bg-black/[0.02] border border-black/5 rounded-lg px-3 py-2 mr-6'
            }`}
          >
            {msg.role === 'assistant' ? (
              msg.content ? (
                <div className="ai-markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="text-[var(--archive-ink-grey)]">AI 正在思考...</span>
              )
            ) : (
              msg.content || (
                <span className="text-[var(--archive-ink-grey)]">AI 正在思考...</span>
              )
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t border-black/10 border-dashed">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
            disabled={isStreaming}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="archive-action-btn archive-action-btn-primary !h-9 !w-9 !p-0 flex items-center justify-center shrink-0"
            title="发送"
            aria-label="发送"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}