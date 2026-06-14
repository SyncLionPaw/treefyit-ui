# TreefyIt Demo Frontend Behavior

本文档记录前端当前已经落地的关键行为，避免实现和设计说明脱节。产品级视觉与信息架构以 `treefyit-design.md` 为准；Build/Agent 后端服务契约以 `apidoc.md` 为准。

## Build

Build 屏负责上传文档、构建知识树、查看单次构建结果。它只展示当前构建的一棵树，不展示 Universe 的多知识库森林。

### 构建流程

- 上传入口只在 Build 左侧 Dropzone 中出现，Chat 不处理文件上传。
- 前端优先使用 `POST /api/build/stream`，请求仍为 `multipart/form-data`，字段包括 `file`、`model`、`mode`、`summarize`。
- 流式响应使用 `application/x-ndjson`，逐行消费 `start / progress / warning / done / error` 事件。
- 如果流式接口返回 `404 / 405`，前端回退旧 `POST /api/build`，保证旧服务可用。
- 构建等待期间，Build Tree 按钮位置切换为轻量进度条。
- 进度阶段颜色必须和阶段小灯一致：上传绿、解析蓝、构建橙。
- 新流式接口的 `save_original / save_original_done / parse / parse_done / structure / md_parsed / semantic / structure_done / refine / thin / thin_done / summarize / verify / verify_done` 事件会映射到现有三阶段进度；最终以 `done.result` 为准。
- 后端 `message` 可能是英文调试短语；UI 展示必须按 `stage` 本地化，并可补充 `chars / nodes / node_count / done / total / score` 等进度细节。

### History

- `GET /api/history` 返回摘要列表，不包含 `raw_text`、`tree`、`mermaid` 等大字段。
- 点击历史项时，如果本地缓存中只有摘要，前端必须再调用 `GET /api/build/{bid}` 拉取完整 build。
- 历史摘要需要保留 `has_original_file`、`original_file_url`、`content_type`、`file_size`，用于判断 Preview 原件能力。

## Result Tabs

### Diagram

- 使用 `@antv/g6` 渲染当前 Build 的单树图。
- 数据来源是 `treeStore.buildFlatNodes` 和 `treeStore.buildLinks`。
- 数据层必须保留 `buildFlatNodes` 全量节点；节点数超过浏览器安全阈值时，G6 canvas 自动进入 LOD，只渲染 root/浅层节点、当前选中路径、children/兄弟节点和高信息量节点。
- 节点数量增多时通过限制交互图形数量、缩小节点、缩短力导边距、关闭 label、关闭动画和 `fitView` 自适应。
- 支持拖拽、缩放、节点点击选中和 Labels 开关。
- Build Diagram 不读取 Universe 的 `flatNodes` / `links`，避免把多树森林混入单树工作台。

### Detail Tree

- Detail Tree 是真实可折叠树，不是固定 depth 的扁平列表。
- 可见节点由 `expandedDetailNodeIds`、`buildFlatNodes.parentId` 和 `buildLinks` 共同计算。
- 有 children 的节点显示折叠箭头。
- 点击箭头只展开或折叠，不触发行选中。
- 点击行本身只选中节点，不强制展开。
- 切换 build 时默认展开 root 和一级分支，避免只显示单个根节点。

### Preview

Preview 必须展示真实文件或后端解析文本，不能用当前节点 summary/text 冒充文件预览。

- `原件` 模式优先使用当前浏览器内的 `File`。
- 如果没有本地 `File`，但 build 返回 `original_file_url`，则使用后端原件 URL。
- PDF 原件使用 iframe 预览。
- HTML 原件使用 iframe 预览，并带 `sandbox`。
- Markdown / TXT / JSON 等文本原件会读取文本并进入 Markdown 或纯文本渲染。
- `解析文本` 模式使用后端 `raw_text`。
- 如果 `has_original_file=false` 或没有 `original_file_url`，原件态展示无边框空态提示。
- Preview 空态不额外画卡片框，也不使用描边按钮。

### Markdown Rendering

Chat 气泡和 Preview Markdown 共用 `src/utils/markdown.ts`。

- 基础渲染使用 `markdown-it`。
- 多余连续空行归并，行尾空白会 trim。
- Markdown 表格必须渲染为真实 `<table>`。
- 如果解析文本混入 `<table>...</table>` HTML 片段，前端先转换为 Markdown 表格，再交给 `markdown-it` 渲染。
- 行内公式 `$...$` 和块级公式 `$$...$$` 会渲染为 KaTeX DOM。
- KaTeX 通过 `index.html` 加载 CDN CSS/JS；如果 CDN 未加载成功，公式安全降级为 LaTeX 原文，不阻断页面。
- 块级公式允许横向滚动，避免长公式撑破 Preview。
- `markdown-it` 的 `html` 仍保持关闭，不直接放开任意 HTML。

### JSON

- JSON tab 展示后端返回的原始 `currentBuild`。
- 使用 `JsonRenderer raw` 渲染标准 JSON 文本。
- 不能展示前端加工后的 `buildTrees`。
- 不能用 JS object tree 冒充 raw JSON。
- 超长 string 默认折叠为 `...` 胶囊，点击后展开。

## Chat

### Markdown

- Chat 气泡必须走统一 Markdown 渲染，不直接展示 Markdown 原文。
- 表格、代码、列表、标题、公式都需要按最终 HTML 效果展示。
- 流式追加内容时，消息区需要自动滚动到底部。

### Session API

- 首次提问不传 `session_id`。
- 后端在 `start.session_id` 或 `done.session_id` 返回 session 后，前端按当前 build 复用该 session。
- 后续同一 build 追问带回 `session_id`。
- Chat stream 同时兼容 NDJSON 行和标准 SSE `data: {...}` 行。
- Chat Sidebar 的 `聊天记录` Tab 消费 `GET /api/sessions?bid={build_id}&limit=50`，默认只展示当前知识库对应的会话。
- 点击某个会话时调用 `GET /api/sessions/{session_id}/turns?limit=200`，将后端 `user / assistant` turns 还原成当前主消息流；assistant turn 的 `tool_calls / tool_results` 还原成工具块，供 Replay 继续解析。
- 删除会话调用 `DELETE /api/sessions/{session_id}`；如果删除的是当前会话，前端清空当前消息并重置 `currentSessionId`。

### Replay

- Replay 以播放器式 modal 展示。
- 左侧是缩小版对话气泡和工具调用流。
- 工具调用块复用正常 Chat 的工具块样式。
- 左侧回放消息会自动滚动到当前步骤。
- 右侧只显示 G6 canvas 图，不展示额外标题、当前节点文字或说明。
- Replay 右侧图必须使用 `@antv/g6` canvas，不能用 DOM 树冒充。
- Replay 数据不裁剪 tree 或 children；大树 canvas 自动进入 LOD，优先保留工具命中节点、祖先链、children、兄弟节点和浅层概览。
- 工具定位到节点时，右侧 G6 图需要调用 `focusElement(activeNodeId)` 将命中节点平滑居中。
- 节点默认无 label，只有工具命中的节点显示短 label。
- 工具命中节点使用橙色高亮，祖先链使用弱橙色提示。

## Build Service Integration

前端会消费 Build Service 的构建结果，但 `apidoc.md` 的定位是后端服务文档：上传文件构建知识库，并提供面向 Agent 的树检索和问答能力。前端当前主要消费的 build 字段如下：

```ts
interface BuildRecord {
  id: string
  filename: string
  content_type?: string
  file_size?: number
  sha256?: string
  storage_key?: string
  has_original_file?: boolean
  original_file_url?: string | null
  raw_text?: string
  mermaid?: string
  tree?: TreeNode[]
  stats?: BuildStats
  node_count?: number
  created_at: string
  cached?: boolean
  error?: string
}
```

前端会用到的关键 endpoints：

- `POST /api/build`
- `GET /api/history`
- `GET /api/build/{bid}`
- `GET /api/build/{bid}/file`
- `DELETE /api/build/{bid}`
- `POST /api/chat`
- `GET /api/sessions`
- `GET /api/sessions/{sid}/turns`
- `DELETE /api/sessions/{sid}`

## Verification Notes

- 当前工作环境里 `node` / `npm` / `bun` 不在 PATH，无法在本机终端执行完整构建。
- 每次改动后优先使用编辑器诊断检查 TypeScript/Vue 错误。
- 若在可用 Node 环境中验证，建议执行：

```bash
npm install
npm run build
```

或使用项目已有 Bun 工作流：

```bash
bun install
bun run build
```
