# DocFlow

一款基于 Tauri + React 构建的桌面 PDF 阅读器，集成 AI 辅助阅读、批注管理和文献库功能。

## 功能一览

### 文献库管理
- 从本地文件夹批量导入 PDF（支持递归扫描子目录）
- 直接通过 arXiv ID 下载论文
- 收藏、重命名、搜索过滤
- 网格 / 列表两种视图模式
- 拖拽打开文件

### PDF 阅读
- 多标签页同时打开多个文档
- 缩放控制（适应宽度 / 100% / 记忆上次缩放）
- 侧边栏缩略图预览 + 文档目录导航
- 全文搜索，高亮匹配结果并逐条跳转
- 自动记忆阅读进度，下次打开恢复到上次位置

### 批注
- 高亮 & 下划线，5 种颜色可选
- 为批注添加备注
- 批注面板集中查看、编辑、删除
- 橡皮擦模式，点击即删
- 所有批注自动持久化

### AI 辅助阅读
- 单页摘要 / 全文摘要
- 对话式问答，基于当前页面内容
- 流式输出 + Markdown 渲染
- 支持自定义模型和 API Key（通过 OpenRouter）

### 快捷键

| 操作 | 快捷键 |
|------|--------|
| 上 / 下一页 | `↑` `↓` 或方向键 |
| 放大 / 缩小 | `+` `-` |
| 重置缩放 | `0` |
| 首页 / 末页 | `Home` `End` |
| 搜索 | `Cmd/Ctrl + F` |
| 跳转页码 | `Cmd/Ctrl + G` |

## 技术栈

- [Tauri 2](https://tauri.app/) — 桌面应用框架
- [React 19](https://react.dev/) + TypeScript
- [Vite 7](https://vite.dev/) — 构建工具
- [Tailwind CSS v4](https://tailwindcss.com/)
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF 渲染
- [OpenRouter](https://openrouter.ai/) — AI 模型接入

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动 Tauri 桌面应用（开发模式）
npm run tauri dev
```

## 设置

在应用内点击设置图标可配置：

- 打开文件时恢复上次阅读位置 或 从第一页开始
- 默认缩放模式
- arXiv 论文下载目录
- AI 功能开关、API Key、模型选择、每日用量限制

## License

MIT
