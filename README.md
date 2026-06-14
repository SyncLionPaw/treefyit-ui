# TreefyIt Demo

TreefyIt Demo 是一个 Vue 3 + Vite + TypeScript 前端原型，用于把文档构建为 Agent 可解释检索的结构化知识树，并提供 Build、Chat、Query、Universe 多视图体验。

TreefyIt 的重点不是“和文档聊天”，而是作为一种 AI 基础设施，让 Agent 在工作过程中需要参考文档时，可以像人读目录和章节一样可解释地拿到相关内容。人类界面用于查看、验证和调试这套知识树与检索路径。

## Tech Stack

- Vue 3 + `<script setup>`
- TypeScript
- Vite
- Pinia
- Sass
- `@antv/g6`
- `markdown-it`
- KaTeX

## Screens

- `Build`：上传 `.md / .pdf / .html / .zip`，调用后端构建知识树，查看 Diagram / Detail Tree / Preview / JSON。
- `Chat`：基于当前 build 提问，支持 Markdown、表格、公式、工具事件和 Replay。
- `Query`：结构化调用树检索工具，查看工具返回结果和统计。
- `Universe`：深层视图，展示多知识库森林和沉浸式知识空间。

## Docs

- [Frontend Behavior](./docs/frontend-behavior.md)：前端已落地行为，包括 Preview、Detail Tree、Markdown/公式、Chat Replay、API 对接。
- [Build Service API](./apidoc.md)：上传文件构建知识库、持久化原件、面向 Agent 检索知识树的后端服务接口。
- [Agent Readme](./docs/AGENTS.md)：给 Agent 读取的精简接入说明，包含推荐调用顺序和核心工具端点。
- [MCP / Skill Integration](./docs/MCP.md)：面向 MCP 或 Skill 的产品化集成方案，只暴露少数工具方法供 Agent 检索文档。
- [Design Spec](./treefyit-design.md)：产品设计、视觉规范、信息架构和实现边界。

## Development

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

构建：

```bash
npm run build
```

如果使用 Bun：

```bash
bun install
bun run dev
bun run build
```

## Backend

默认本地 API 走 same-origin `/api`，通常由 Vite proxy 转发到后端服务。后端源实现目前位于：

```text
/Users/bytedance/docs/PageIndex/treefyit
```

Build 原件预览依赖后端持久化原件并返回：

- `has_original_file`
- `original_file_url`
- `content_type`
- `file_size`

详情见 [API Doc](./apidoc.md)。
