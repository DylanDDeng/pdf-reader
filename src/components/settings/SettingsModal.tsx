import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { OpenFileLocationMode, ReaderSettings } from '../../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  settings: ReaderSettings;
  onClose: () => void;
  onChangeOpenFileLocation: (mode: OpenFileLocationMode) => void;
}

interface LocationOption {
  mode: OpenFileLocationMode;
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

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onChangeOpenFileLocation,
}: SettingsModalProps) {
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

