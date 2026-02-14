import { useState } from 'react';
import { Search, LayoutGrid, FileText, Bookmark } from 'lucide-react';
import type { OutlineItem } from '../../utils/pdf';

interface ReaderSidebarProps {
  outline: OutlineItem[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ReaderSidebar({
  outline,
  currentPage,
  totalPages,
  onPageChange,
}: ReaderSidebarProps) {
  const [filterText, setFilterText] = useState('');

  const filteredOutline = outline.filter((item) =>
    item.title.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <aside className="w-72 bg-[#f6f7f8] flex flex-col border-r border-slate-200 h-full">
      {/* Filter Input */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter pages..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Outline List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {outline.length === 0 ? (
          // No outline in PDF
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Bookmark className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">暂无目录</p>
            <p className="text-xs text-slate-400 max-w-[200px]">
              此 PDF 文件没有包含书签目录
            </p>
            {/* Show page thumbnails as fallback */}
            <div className="mt-6 w-full">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3 px-1">
                页面预览
              </p>
              <div className="space-y-2">
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                      currentPage === pageNum
                        ? 'bg-white shadow-sm border border-slate-200'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-10 h-12 bg-slate-200 rounded border border-slate-300 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-medium ${
                        currentPage === pageNum ? 'text-slate-900' : 'text-slate-600'
                      }`}>
                        Page {pageNum}
                      </p>
                    </div>
                    {currentPage === pageNum && (
                      <span className="text-xs text-blue-500 font-medium">当前</span>
                    )}
                  </button>
                ))}
                {totalPages > 10 && (
                  <p className="text-center text-xs text-slate-400 py-2">
                    + {totalPages - 10} 更多页面
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : filteredOutline.length === 0 ? (
          // Has outline but filter returned no results
          <div className="text-center py-8 text-slate-400 text-sm">
            No results found
          </div>
        ) : (
          <div className="space-y-1">
            {filteredOutline.map((item, index) => (
              <button
                key={index}
                onClick={() => onPageChange(item.page)}
                className={`w-full text-left p-3 rounded-lg transition-all group ${
                  currentPage === item.page
                    ? 'bg-white shadow-sm border border-slate-200'
                    : 'hover:bg-slate-100'
                }`}
                style={{ paddingLeft: `${12 + item.level * 16}px` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        currentPage === item.page
                          ? 'text-slate-900'
                          : item.level === 0
                          ? 'text-slate-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.level === 1 && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        Continue reading from page {item.page}...
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs shrink-0 ${
                      currentPage === item.page
                        ? 'text-blue-500 font-medium'
                        : 'text-slate-400'
                    }`}
                  >
                    Pg {item.page}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails Toggle */}
      <div className="p-3 border-t border-slate-200">
        <button className="w-full flex items-center justify-between px-3 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <span className="text-xs font-medium uppercase tracking-wide">Thumbnails</span>
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
