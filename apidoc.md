# TreefyIt Build Service API

TreefyIt Build Service 是面向 Agent 的可解释文档知识基础设施。它接收用户上传的 `.md / .pdf / .html / .zip` 文件，持久化保存原件，解析出 `raw_text`，构建人类也能看懂的结构化知识树，并把该知识树注册成可被 Agent 查询的 tree。

服务的核心目标不是“让人和文档聊天”，也不是服务某个前端页面，而是让 Agent 在工作过程中需要参考文档时，能像人读目录、翻章节、查段落一样，稳定、低成本、可解释地拿到相关内容。

## Service Capabilities

- **上传构建**：通过 `POST /api/build` 上传文件并构建知识树；推荐 UI/Agent 宿主使用 `POST /api/build/stream` 获取真实阶段进度。
- **原件持久化**：保存上传原件，并通过 `GET /api/build/{bid}/file` 返回原件二进制流。
- **构建历史**：通过 `GET /api/history` 和 `GET /api/build/{bid}` 查询历史构建结果。
- **Agent 检索**：通过 `/api/trees/*` 接口提供 overview、inspect node、get children 等树检索能力；主路径是 `overview -> children -> inspect`，而不是黑盒 embedding-only RAG。
- **查询审计**：通过 `/api/queries` 和 `/api/queries/stats` 查看 Agent 工具调用日志。
- **对话问答**：通过 `POST /api/chat` 在指定 build/tree 上进行带 session 记忆的问答。

## Basic Rules

- 所有业务路径前缀均为 `/api`。
- JSON 接口返回 `application/json`。
- 原件接口 `GET /api/build/{bid}/file` 返回原始二进制流，`Content-Type` 取决于上传文件类型。
- `bid` 是一次构建的 ID，也是 Agent tools 中使用的 `tree_id`。
- 知识树是主要检索界面；向量/关键词搜索如果后续加入，只作为补充能力。
- Agent 返回内容应尽量携带 `tree_id`、`path`、`title`、来源文件等证据锚点，方便人类审计和调试。
- 源实现见 [server.py](file:///Users/bytedance/docs/PageIndex/treefyit/src/server/server.py)。

## Typical Workflow

```text
1. Client 上传文件
   POST /api/build/stream

2. Build Service 保存原件、抽取 raw_text、构建知识树
   返回 bid / tree / raw_text / original_file_url / stats

3. Agent 使用 bid 作为 tree_id 查询知识树
   GET /api/trees/{tree_id}
   GET /api/trees/{tree_id}/nodes/{path}
   GET /api/trees/{tree_id}/children/{path}

4. Agent 或 UI 可基于同一 build 发起问答
   POST /api/chat
```

## 1. Build API — 上传文件并构建知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/build` | 上传文件并构建知识库树；支持 `.md / .pdf / .html / .zip`，命中缓存时直接返回 |
| POST | `/api/build/stream` | 上传文件并流式构建知识库树；NDJSON 逐行返回 `start/progress/warning/done/error` |
| GET  | `/api/history` | 按时间倒序列出构建记录摘要（不含大字段） |
| GET  | `/api/build/{bid}` | 读取某次构建的完整结果 |
| GET  | `/api/build/{bid}/file` | 读取某次构建持久化保存的原件二进制流 |
| DELETE | `/api/build/{bid}` | 删除某次构建及其原件、缓存、Agent tree 注册信息 |

#### POST /api/build

- **请求**: `multipart/form-data`
  - `file` (文件, 必需) – 要处理的文档；支持 `.md` / `.pdf` / `.html` / `.htm` / `.zip`
  - `model` (string) – 大模型标识，默认 `deepseek/deepseek-chat`
  - `mode` (string) – 解析模式，`auto`（默认，按标题 + 编号）/ `md`（纯 Markdown 标题）/ `semantic`（LLM 驱动）
  - `summarize` (boolean) – 是否为节点生成摘要，默认 `true`

- **成功响应** (`200 application/json`)

```json
{
  "id": "1902897a3b4c0d1e",
  "filename": "README.md",
  "content_type": "text/markdown; charset=utf-8",
  "file_size": 1234567,
  "sha256": "2f4c...9a",
  "has_original_file": true,
  "original_file_url": "/api/build/1902897a3b4c0d1e/file",
  "raw_text": "原始文档文本字符串...",
  "mermaid": "flowchart TD\n  0[\"标题 A\"]\n  0 --> 1[\"标题 A.1\"]\n...",
  "tree": [
    {
      "title": "1. Introduction",
      "text": "This section introduces...",
      "summary": "介绍项目背景与动机。",
      "children": [
        {
          "title": "1.1 Motivation",
          "text": "...",
          "summary": "...",
          "children": []
        }
      ]
    }
  ],
  "stats": {
    "input_tokens": 1200,
    "output_tokens": 320,
    "node_count": 42,
    "elapsed_sec": 3.1,
    "model": "deepseek/deepseek-chat",
    "mode": "auto"
  },
  "created_at": "14:30:05",
  "cached": true
}
```

字段说明：

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | string | 构建 ID；由 `int(now * 1000)` 的十六进制前缀生成，作为持久化 key |
| `filename` | string | 上传时的原始文件名 |
| `content_type` | string | 原件 MIME 类型，例如 `application/pdf`、`text/html`、`text/markdown` |
| `file_size` | number | 原件大小，单位 bytes |
| `sha256` | string | 原件内容哈希，用于校验和 ETag |
| `has_original_file` | boolean | 后端是否持久化保存了原件 |
| `original_file_url` | string? | 原件预览/下载地址，通常为 `/api/build/{bid}/file` |
| `raw_text` | string | 文档提取的纯文本（PDF/HTML 会先转成文本）；可能很长 |
| `mermaid` | string | 该树对应的 Mermaid 流程图源码 |
| `tree` | `list[Node]` | 递归树；每个节点含 `title`, `text`, `summary`, `children: list[Node]` |
| `stats` | object | `{input_tokens, output_tokens, node_count, elapsed_sec, model, mode}` |
| `created_at` | string | `HH:MM:SS` 时间戳（服务端本地） |
| `cached` | boolean | 本次是否命中输入内容缓存（`true` 表示未重新解析） |
| `error` | string? | 仅在失败时出现，内容为错误消息；此时 `tree`/`mermaid` 通常为空 |

- **失败响应** (`200 application/json`)

```json
{
  "id": "1902897a3b4c0d1e",
  "filename": "broken.pdf",
  "error": "....",
  "tree": [],
  "mermaid": "",
  "stats": {
    "input_tokens": 0,
    "output_tokens": 0,
    "node_count": 0,
    "elapsed_sec": 0.1,
    "model": "deepseek/deepseek-chat",
    "mode": "auto"
  },
  "created_at": "14:30:05"
}
```

缓存 key 由 `sha256(text|model|mode|summarize)[:16]` 计算，命中时直接跳过解析。

#### POST /api/build/stream

- **请求**: 与 `POST /api/build` 相同，使用 `multipart/form-data`
- **响应**: `200 application/x-ndjson`
- **兼容性**: 旧 `POST /api/build` 保持不变；新客户端推荐优先使用流式接口，404/405 时可回退旧接口。

每一行是一个 JSON 事件：

```json
{"type":"start","stage":"start","bid":"1902897a3b4c0d1e","filename":"paper.pdf","model":"deepseek/deepseek-chat","mode":"auto","summarize":true,"file_size":1234567,"elapsed_sec":0}
{"type":"progress","stage":"save_original","message":"saving original file","elapsed_sec":0.1}
{"type":"progress","stage":"save_original_done","storage_key":"originals/1902897a3b4c0d1e/paper.pdf","file_size":1234567,"elapsed_sec":0.1}
{"type":"progress","stage":"parse","message":"reading document","elapsed_sec":0.2}
{"type":"progress","stage":"parse_done","chars":58291,"elapsed_sec":0.7}
{"type":"progress","stage":"structure","message":"building structure","elapsed_sec":0.8}
{"type":"progress","stage":"md_parsed","nodes":128,"elapsed_sec":0.9}
{"type":"progress","stage":"structure_done","root_nodes":1,"node_count":128,"semantic_used":false,"elapsed_sec":1.1}
{"type":"progress","stage":"thin","message":"thinning tree","elapsed_sec":1.1}
{"type":"progress","stage":"thin_done","node_count":128,"elapsed_sec":1.2}
{"type":"progress","stage":"summarize","done":17,"total":128,"elapsed_sec":4.2}
{"type":"progress","stage":"verify","message":"verifying tree","elapsed_sec":8.8}
{"type":"progress","stage":"verify_done","ok":true,"score":0.92,"elapsed_sec":9.4}
{"type":"done","stage":"done","cached":false,"result":{"id":"1902897a3b4c0d1e","filename":"paper.pdf","tree":[],"raw_text":"...","stats":{"node_count":128}}}
```

事件说明：

| 事件 | 含义 |
|------|------|
| `start` | 构建任务开始；返回 `bid / filename / model / mode / file_size` |
| `progress` | 阶段进度；`stage` 可能为 `save_original / save_original_done / parse / parse_done / structure / md_parsed / semantic / structure_done / refine / thin / thin_done / summarize / verify / verify_done` |
| `warning` | 非致命问题；前端可短暂展示，但不应中断构建 |
| `done` | 构建完成；`result` 与旧 `POST /api/build` 的完整返回一致 |
| `error` | 构建失败；包含 `message`，可能带失败态 `result` |

前端读取方式：

```ts
const res = await fetch('/api/build/stream', { method: 'POST', body: formData })
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''

  for (const line of lines) {
    if (!line.trim()) continue
    const event = JSON.parse(line)
    // event.type / event.stage / event.done / event.total / event.result
  }
}
```

#### GET /api/history

- **请求**: 无参数
- **响应**: `200 application/json`

```json
[
  {
    "id": "1902897a3b4c0d1e",
    "filename": "paper.pdf",
    "content_type": "application/pdf",
    "file_size": 1234567,
    "has_original_file": true,
    "original_file_url": "/api/build/1902897a3b4c0d1e/file",
    "node_count": 42,
    "created_at": "14:30:05"
  },
  "..."
]
```

返回最近构建的摘要列表，按 `created_at` 降序；不包含 `raw_text`、`tree`、`mermaid` 等大字段。需要完整树、解析文本或调试信息时，再调用 `GET /api/build/{bid}`。

#### GET /api/build/{bid}

- **路径参数**: `bid` (string) – 构建 ID
- **成功响应** (`200 application/json`): 与 `POST /api/build` 相同的完整 build 对象
- **未找到** (`404 application/json`):

```json
{ "error": "not found" }
```

#### GET /api/build/{bid}/file

- **路径参数**: `bid` (string) – 构建 ID
- **成功响应**: 原件二进制流；用于 Preview 的 `原件` 模式
- **响应头**:

```http
Content-Type: application/pdf
Content-Disposition: inline; filename="paper.pdf"
Cache-Control: private, max-age=300
ETag: "sha256-2f4c...9a"
```

- **原件缺失** (`404 application/json`):

```json
{
  "error": {
    "code": "ORIGINAL_FILE_NOT_FOUND",
    "message": "Original file is not available for this build."
  }
}
```

#### DELETE /api/build/{bid}

- **成功响应** (`200 application/json`):

```json
{ "ok": true }
```

删除操作会同时清理：进程内的 `history` 字典、`builds` SQLite 行、磁盘上的 `build_{bid}.json` 文件、持久化原件，以及 Agent 工具注册表中的对应 `tree_id`。

---

## 2. Agent Tools API — 检索已构建的知识树

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/trees` | 列出当前注册过的 tree_id（与 build id 一致） |
| GET | `/api/trees/{tree_id}` | 某树的概览（overview） |
| GET | `/api/trees/{tree_id}/nodes/{path}` | inspect 指定路径节点的详细内容 |
| GET | `/api/trees/{tree_id}/children/{path}` | 获取指定路径节点的子节点列表 |
| GET | `/api/queries` | 最近 200 条工具调用记录 |
| GET | `/api/queries/stats` | 查询统计：总数、按工具/按树聚合、最近 20 条 |

路径 `{path}` 为点分索引路径，例如 `0`、`0.1`、`0.1.2`。

调用 `/api/trees/*` 系列接口会同时向 `queries` 表追加一行日志，供 `/api/queries` 使用。这组接口是面向 Agent 的稳定工具层：Agent 不需要理解原始文档格式，只需要通过 `tree_id` 和 `path` 逐步检索知识树。

#### GET /api/trees

- **响应** (`200 application/json`):

```json
[
  { "tree_id": "1902897a3b4c0d1e", "node_count": 42, "max_depth": 4 },
  "..."
]
```

#### GET /api/trees/{tree_id}

- **成功响应** (`200 application/json`):

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "node_count": 42,
  "max_depth": 4,
  "roots": [
    { "path": "0", "title": "1. Introduction", "summary": "...", "children_count": 2 },
    { "path": "1", "title": "2. Design",       "summary": "...", "children_count": 0 }
  ]
}
```

- **未知 tree_id** (`200 application/json`):

```json
{ "error": "unknown tree_id: <id>" }
```

#### GET /api/trees/{tree_id}/nodes/{path}

- **成功响应** (`200 application/json`):

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "path": "0.1",
  "title": "1.1 Motivation",
  "text": "本小节的完整正文...",
  "summary": "该节点的 LLM 摘要，若未开启 summarize 则为空字符串。",
  "children_count": 2,
  "children": ["0.1.0", "0.1.1"]
}
```

- **未知 tree_id / 路径不合法**:

```json
{ "error": "unknown tree_id: <id>" }
{ "error": "invalid path: <path>" }
```

#### GET /api/trees/{tree_id}/children/{path}

- **成功响应** (`200 application/json`):

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "path": "0",
  "title": "1. Introduction",
  "children_count": 2,
  "children": [
    { "path": "0.0", "title": "1.1 Motivation", "summary": "...", "children_count": 0 },
    { "path": "0.1", "title": "1.2 Background", "summary": "...", "children_count": 1 }
  ]
}
```

#### GET /api/queries

- **响应** (`200 application/json`, 最多 200 条，最新在前):

```json
[
  {
    "tool": "inspect",
    "tree_id": "1902897a3b4c0d1e",
    "path": "0.1",
    "summary": "node: 1.1 Motivation (0 children)",
    "timestamp": "2026-06-12 14:31:08"
  },
  "..."
]
```

`summary` 规则：若结果包含 `error` 字段 → `error: <msg>`；若包含 `title` → `node: <title> (N children)`；若包含 `roots` → `tree: N nodes, depth D`；否则为 `ok`。

#### GET /api/queries/stats

- **响应** (`200 application/json`):

```json
{
  "total": 128,
  "by_tool": { "inspect": 50, "overview": 40, "get_children": 38 },
  "by_tree": { "1902897a3b4c0d1e": 118, "1902a9c37bb88d11": 10 },
  "recent": [ "<同 GET /api/queries 中每条的结构，最多 20 条>" ]
}
```

---

## 3. Chat API — 基于知识树的问答（流式）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 向已构建的文档提问；支持 session 记忆，流式返回 NDJSON / SSE 事件 |
| GET | `/api/sessions` | 列出聊天会话（可按 `bid` 过滤） |
| GET | `/api/sessions/{sid}/turns` | 获取某会话的所有轮次 |
| DELETE | `/api/sessions/{sid}` | 删除会话及其轮次 |

#### POST /api/chat

- **请求**: `application/json`

```json
{
  "bid": "1902897a3b4c0d1e",
  "question": "这篇论文的核心结论是什么？",
  "model": "deepseek-chat",
  "session_id": "s_abc123"
}
```

字段说明：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `bid` | string | 是 | 构建 ID |
| `question` | string | 是 | 用户问题 |
| `model` | string | 否 | 默认 `deepseek-chat` |
| `session_id` | string | 否 | 可选；提供时复用该 session 的历史上下文，省略时自动创建新 session |

- **响应**: `text/event-stream`（NDJSON 或 `data: {...}` SSE 行，每行一条 JSON）

```json
{"type": "start", "bid": "1902897a3b4c0d1e", "filename": "paper.pdf", "model": "deepseek-chat", "session_id": "s_abc123"}
{"type": "text", "text": "该论文提出了"}
{"type": "tool_call", "id": "call_1", "name": "node_content", "arguments": "{\"path\": \"0\"}"}
{"type": "tool_result", "id": "call_1", "name": "node_content", "ok": true, "content": "..."}
{"type": "done", "answer": "该论文提出了一种新的树结构索引方法...", "turns": 2, "prompt_tokens": 1200, "completion_tokens": 340, "total_tokens": 1540}
```

事件类型：

| 类型 | 说明 |
|------|------|
| `start` | 会话开始；含 `bid`, `filename`, `model`, `session_id` |
| `text` | 答案文本增量 |
| `reasoning` | 模型内部思考（仅 reasoning 模型） |
| `tool_call` | 模型调用工具；含 `id`, `name`, `arguments` |
| `tool_result` | 工具执行结果；含 `id`, `name`, `ok`, `content` |
| `done` | 最终答案与用量统计 |
| `error` | 执行中断错误 |

Session 机制：首次提问时不填 `session_id`，后端会自动创建并在 `start` 事件中返回。后续追问带上同一个 `session_id`，agent 会自动加载之前的对话历史。

#### GET /api/sessions

- **参数**: `bid` (string, 可选) 过滤；`limit` (integer, 可选, 默认 100)
- **示例**:
  - `GET /api/sessions`
  - `GET /api/sessions?bid={build_id}`
  - `GET /api/sessions?bid={build_id}&limit=50`
- **响应** (`200 application/json`):

```json
{
  "sessions": [
    {
      "id": "s_abc123",
      "bid": "1902897a3b4c0d1e",
      "model": "deepseek-chat",
      "title": "这篇论文的核心结论是什么？",
      "turn_count": 4,
      "created_at": "2026-06-13T10:30:00Z",
      "updated_at": "2026-06-13T10:35:00Z"
    }
  ]
}
```

#### GET /api/sessions/{sid}/turns

- **参数**: `sid` (path, 必需); `limit` (query, 可选, 默认 200)
- **示例**: `GET /api/sessions/{session_id}/turns?limit=200`
- **响应** (`200 application/json`):

```json
{
  "session_id": "s_abc123",
  "turns": [
    { "session_id": "s_abc123", "turn_idx": 0, "role": "user", "text": "...", "tool_calls": null, "tool_results": null, "created_at": "..." },
    { "session_id": "s_abc123", "turn_idx": 1, "role": "assistant", "text": "...", "tool_calls": "[{...}]", "tool_results": "[{...}]", "created_at": "..." }
  ]
}
```

#### DELETE /api/sessions/{sid}

- **成功响应** (`200 application/json`):

```json
{ "deleted": true, "session_id": "s_abc123" }
```

---

## 4. Base URL / CORS

- 默认监听 `0.0.0.0:8765`
- 统一前缀 `/api`；所有响应为 `application/json`
- 当前未启用额外的 CORS 中间件；若调用方与 Build Service 不同源/端口，请在 `server.py` 中添加 `CORSMiddleware`。
