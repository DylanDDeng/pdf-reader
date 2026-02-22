import { useEffect } from 'react';
import { FolderOpen, X } from 'lucide-react';
import type { DefaultZoomMode, OpenFileLocationMode, ReaderSettings } from '../../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  settings: ReaderSettings;
  aiUsage: {
    date: string;
    requests: number;
    failures: number;
  };
  onClose: () => void;
  onChangeOpenFileLocation: (mode: OpenFileLocationMode) => void;
  onChangeDefaultZoomMode: (mode: DefaultZoomMode) => void;
  onChangeArxivDownloadFolder: (folder: string | null) => void;
  onChangeAiEnabled: (enabled: boolean) => void;
  onChangeOpenRouterApiKey: (apiKey: string) => void;
  onChangeOpenRouterModel: (model: string) => void;
  onChangeAiReasoningEnabled: (enabled: boolean) => void;
  onChangeAiDailyUsageSoftLimit: (limit: number) => void;
  onResetAiUsage: () => void;
}

interface LocationOption {
  mode: OpenFileLocationMode;
  title: string;
  description: string;
}

interface ZoomOption {
  mode: DefaultZoomMode;
  title: string;
  description: string;
}

const OPEN_FILE_LOCATION_OPTIONS: LocationOption[] = [
  {
    mode: 'last_read_page',
    title: '上次阅读页',
    description: '重新打开同一份 PDF 时，自动跳转到你上次阅读的页码。',
  },
  {
    mode: 'first_page',
    title: '总是第一页',
    description: '每次打开文件都从第 1 页开始阅读。',
  },
];

const DEFAULT_ZOOM_OPTIONS: ZoomOption[] = [
  {
    mode: 'fit_width',
    title: '适应宽度',
    description: '自动贴合阅读区域宽度，窗口尺寸变化时会自动重算。',
  },
  {
    mode: 'fixed_100',
    title: '100%',
    description: '始终以 100% 缩放打开文档。',
  },
  {
    mode: 'remember_last',
    title: '记住上次缩放',
    description: '按文档记住你上次的自定义缩放比例。',
  },
];

export function SettingsModal({
  isOpen,
  settings,
  aiUsage,
  onClose,
  onChangeOpenFileLocation,
  onChangeDefaultZoomMode,
  onChangeArxivDownloadFolder,
  onChangeAiEnabled,
  onChangeOpenRouterApiKey,
  onChangeOpenRouterModel,
  onChangeAiReasoningEnabled,
  onChangeAiDailyUsageSoftLimit,
  onResetAiUsage,
}: SettingsModalProps) {
  const handleBrowseArxivFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select default folder for arXiv downloads',
      });

      if (selected && typeof selected === 'string') {
        onChangeArxivDownloadFolder(selected);
      }
    } catch (error) {
      console.error('Failed to choose arXiv download folder:', error);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="archive-settings-overlay" role="presentation">
      <div className="archive-settings-backdrop" onClick={onClose} />
      <section
        className="archive-settings-modal archive-library"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className="archive-settings-header">
          <div>
            <h2 className="archive-settings-title">Settings</h2>
            <p className="archive-settings-subtitle">Reader preferences</p>
          </div>
          <button
            onClick={onClose}
            className="archive-settings-close"
            aria-label="关闭设置"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="archive-settings-content">
          <section className="archive-settings-section">
            <h3 className="archive-settings-section-title">打开文件定位</h3>
            <p className="archive-settings-section-desc">
              控制你重新打开同一份 PDF 时默认跳转的位置。
            </p>

            <div className="archive-settings-options">
              {OPEN_FILE_LOCATION_OPTIONS.map((option) => {
                const isActive = settings.openFileLocation === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => onChangeOpenFileLocation(option.mode)}
                    className={`archive-settings-option ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="archive-settings-radio" aria-hidden>
                      <span className="archive-settings-radio-dot" />
                    </span>
                    <span className="archive-settings-option-copy">
                      <span className="archive-settings-option-title">{option.title}</span>
                      <span className="archive-settings-option-desc">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="archive-settings-section archive-settings-section-divider">
            <h3 className="archive-settings-section-title">默认缩放</h3>
            <p className="archive-settings-section-desc">
              控制新打开文档时的初始缩放策略。
            </p>

            <div className="archive-settings-options">
              {DEFAULT_ZOOM_OPTIONS.map((option) => {
                const isActive = settings.defaultZoomMode === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => onChangeDefaultZoomMode(option.mode)}
                    className={`archive-settings-option ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="archive-settings-radio" aria-hidden>
                      <span className="archive-settings-radio-dot" />
                    </span>
                    <span className="archive-settings-option-copy">
                      <span className="archive-settings-option-title">{option.title}</span>
                      <span className="archive-settings-option-desc">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="archive-settings-section archive-settings-section-divider">
            <h3 className="archive-settings-section-title">arXiv 默认下载目录</h3>
            <p className="archive-settings-section-desc">
              通过 arXiv 链接导入时，PDF 与 metadata.json 会保存到这个目录。
            </p>

            <div className="archive-settings-folder-row">
              <div
                className="archive-settings-folder-display"
                title={settings.arxivDownloadFolder ?? '未设置默认目录'}
              >
                <FolderOpen className="w-4 h-4 shrink-0 text-black/45" />
                <span className={settings.arxivDownloadFolder ? '' : 'archive-settings-folder-placeholder'}>
                  {settings.arxivDownloadFolder ?? '未设置默认目录'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleBrowseArxivFolder}
                className="archive-action-btn archive-action-btn-primary"
              >
                Browse
              </button>

              <button
                type="button"
                onClick={() => onChangeArxivDownloadFolder(null)}
                className="archive-action-btn"
                disabled={!settings.arxivDownloadFolder}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="archive-settings-section archive-settings-section-divider">
            <h3 className="archive-settings-section-title">AI 助手（OpenRouter）</h3>
            <p className="archive-settings-section-desc">
              选中文本后可用 AI 总结和问答。默认开启 reasoning，可在下方调整。
            </p>

            <div className="archive-settings-options">
              <button
                type="button"
                onClick={() => onChangeAiEnabled(!settings.aiEnabled)}
                className={`archive-settings-option ${settings.aiEnabled ? 'is-active' : ''}`}
              >
                <span className="archive-settings-radio" aria-hidden>
                  <span className="archive-settings-radio-dot" />
                </span>
                <span className="archive-settings-option-copy">
                  <span className="archive-settings-option-title">启用 AI 功能</span>
                  <span className="archive-settings-option-desc">关闭后将隐藏选区 AI 操作入口。</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onChangeAiReasoningEnabled(!settings.aiReasoningEnabled)}
                className={`archive-settings-option ${settings.aiReasoningEnabled ? 'is-active' : ''}`}
              >
                <span className="archive-settings-radio" aria-hidden>
                  <span className="archive-settings-radio-dot" />
                </span>
                <span className="archive-settings-option-copy">
                  <span className="archive-settings-option-title">启用 reasoning（默认开启）</span>
                  <span className="archive-settings-option-desc">会提升复杂推理能力，但可能增加耗时和成本。</span>
                </span>
              </button>
            </div>

            <div className="archive-settings-folder-row">
              <div className="archive-settings-folder-display" title={settings.openRouterApiKey ? '已配置' : '未配置'}>
                <span className="text-black/60">OpenRouter API Key</span>
              </div>
              <input
                type="password"
                value={settings.openRouterApiKey}
                onChange={(event) => onChangeOpenRouterApiKey(event.target.value)}
                placeholder="sk-or-..."
                className="archive-action-btn flex-1 min-w-0 !h-10 !justify-start !px-3 text-left font-mono text-xs"
              />
            </div>

            <div className="archive-settings-folder-row">
              <div className="archive-settings-folder-display" title="OpenRouter model id">
                <span className="text-black/60">Model</span>
              </div>
              <input
                type="text"
                value={settings.openRouterModel}
                onChange={(event) => onChangeOpenRouterModel(event.target.value)}
                onBlur={(event) => {
                  if (!event.target.value.trim()) {
                    onChangeOpenRouterModel('openai/gpt-4o-mini');
                  }
                }}
                placeholder="anthropic/claude-sonnet-4.6"
                className="archive-action-btn flex-1 min-w-0 !h-10 !justify-start !px-3 text-left font-mono text-xs"
              />
            </div>

            <div className="archive-settings-folder-row">
              <div className="archive-settings-folder-display">
                <span className="text-black/60">每日软提醒阈值</span>
              </div>
              <input
                type="number"
                min={1}
                value={settings.aiDailyUsageSoftLimit}
                onChange={(event) => onChangeAiDailyUsageSoftLimit(Number(event.target.value || 1))}
                className="archive-action-btn w-28 !h-10 !justify-start !px-3 text-left font-mono text-xs"
              />
              <button type="button" onClick={onResetAiUsage} className="archive-action-btn">
                重置今日计数
              </button>
            </div>

            <p className="archive-settings-section-desc mt-2">
              今日调用：{aiUsage.requests} 次（失败 {aiUsage.failures} 次，日期 {aiUsage.date}）
            </p>
          </section>
        </div>

        <footer className="archive-settings-footer">
          <button type="button" onClick={onClose} className="archive-action-btn archive-action-btn-primary">
            完成
          </button>
        </footer>
      </section>
    </div>
  );
}
