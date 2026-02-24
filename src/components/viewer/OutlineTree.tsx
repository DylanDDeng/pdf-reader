import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { OutlineItem } from '../../utils/pdf';

interface OutlineTreeProps {
  outline: OutlineItem[];
  currentPage: number;
  onPageChange: (page: number) => void;
}

interface TreeNode {
  item: OutlineItem;
  children: TreeNode[];
  index: number;
}

function buildTree(items: OutlineItem[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];

  items.forEach((item, index) => {
    const node: TreeNode = { item, children: [], index };

    while (stack.length > 0 && stack[stack.length - 1].item.level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return roots;
}

function findActiveIndex(items: OutlineItem[], currentPage: number): number {
  let activeIdx = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].page <= currentPage) {
      activeIdx = i;
    }
  }
  return activeIdx;
}

function OutlineNode({
  node,
  activeIndex,
  onPageChange,
}: {
  node: TreeNode;
  activeIndex: number;
  onPageChange: (page: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isActive = node.index === activeIndex;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        className={`archive-outline-item ${isActive ? 'is-active' : ''}`}
        style={{ paddingLeft: `${node.item.level * 16 + 8}px` }}
        onClick={() => onPageChange(node.item.page)}
        title={`${node.item.title} — 第 ${node.item.page} 页`}
      >
        {hasChildren && (
          <span
            className="archive-outline-toggle"
            onClick={(e) => { e.stopPropagation(); setCollapsed((p) => !p); }}
          >
            {collapsed
              ? <ChevronRight className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />}
          </span>
        )}
        <span className="archive-outline-title">{node.item.title}</span>
        <span className="archive-outline-page">{node.item.page}</span>
      </button>

      {hasChildren && !collapsed && (
        <div>
          {node.children.map((child) => (
            <OutlineNode
              key={child.index}
              node={child}
              activeIndex={activeIndex}
              onPageChange={onPageChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OutlineTree({ outline, currentPage, onPageChange }: OutlineTreeProps) {
  const tree = useMemo(() => buildTree(outline), [outline]);
  const activeIndex = useMemo(() => findActiveIndex(outline, currentPage), [outline, currentPage]);

  if (outline.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <p className="text-xs text-[var(--archive-ink-grey)] text-center">
          此文档没有目录信息
        </p>
      </div>
    );
  }

  return (
    <div className="archive-outline-list">
      {tree.map((node) => (
        <OutlineNode
          key={node.index}
          node={node}
          activeIndex={activeIndex}
          onPageChange={onPageChange}
        />
      ))}
    </div>
  );
}
