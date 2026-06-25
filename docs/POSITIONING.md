# TreefyIt 优势与传统 RAG 对比

> 场景：**计算化学** — 文档以结构化 HTML / Markdown 为主（软件手册、方法说明、参数参考、工作流文档等）。

## 一句话定位

**TreefyIt 不是「又一个 RAG 平台」，而是面向计算化学 Agent 的可解释文档知识基础设施。**

它把结构化 HTML / Markdown 文档变成一棵**人类也能看懂、Agent 也能导航**的知识树，而不是把手册切成一堆 embedding 相似度 chunk。

---

## 传统 RAG 的典型做法

| 环节 | 传统 RAG |
|------|----------|
| 索引 | 固定长度分块 → 向量化 → 存入向量库 |
| 检索 | `query` → 相似度搜索 → 返回 top-k chunk |
| 结构 | 文档层级被切碎，目录/章节关系丢失 |
| 可解释性 | 黑盒：「这段和 query 相似」 |
| 面向谁 | 人类聊天 UI 或通用检索 API |
| 集成 | 需要理解 chunk、embedding、score threshold 等概念 |

典型代表：Dify 知识库、OpenAI File Search、Pinecone Assistant、LlamaIndex 默认 pipeline。

---

## TreefyIt 的核心优势

### 1. 树结构优先，不是 chunk 优先

传统 RAG 把文档**切碎**；TreefyIt 把文档**建树**：

```text
source → parse → infer levels → refine → build tree → finalize
```

- 保留标题层级（`1`、`1.1`、`一、` 等编号规则 + LLM 推断）
- 长章节自动拆分，父节点保留摘要，正文下沉到子节点
- 每个节点有稳定的 `node_id`、标题、摘要、完整正文

Agent 拿到的是**可导航的文档地图**，不是「一袋相似 chunk」。

### 2. 可解释检索：像人读目录，不像黑盒搜向量

**主路径：**

```text
overview → children → inspect
```

Agent 先看清整棵树的结构，再逐级缩小范围，最后按需读取某个节点的完整内容。

传统 RAG 是 `retrieve(query) → 返回 chunk`；TreefyIt 是**主动导航**，每一步都有明确证据：

- `tree_id`
- `node_id` / path（如 `0.1.2`）
- 节点标题
- 来源文件名

回答可审计、可回放、可调试——UI 里的 Chat Replay、Universe 图谱都建立在这套证据链上。

### 3. Agent-first，工具面极小

传统方案往往工具很多（Workspace、Embedding、Chat、文件管理……），Agent 心智负担大。

TreefyIt 刻意只暴露 **4 个核心工具**：

```text
build_knowledge(file)
overview(tree_id)
inspect(tree_id, node_id)
children(tree_id, node_id)
```

Agent 不需要懂 PDF 解析、分块策略、向量库——**零集成负担**接入任意 MCP / Skill 环境。

### 4. 本地优先 + Provider 中立

- 本地/云端同一套 API，只改 `TREEFYIT_BASE_URL`
- 不绑定 OpenAI Vector Store 或特定云厂商
- 原件持久化，可随时回溯 `/api/build/{bid}/file`

### 5. 天然适配计算化学的结构化文档

计算化学领域的文档几乎全是**层级分明的 HTML / Markdown**：

- 量子化学 / 第一性原理软件手册（Gaussian、VASP、ORCA、CP2K、Quantum ESPRESSO 等）
- 分子动力学 / 力场文档（AMBER、GROMACS、CHARMM 参数说明）
- 工作流与最佳实践（收敛标准、基组选择、泛函对比、输入文件模板）
- 内部方法文档、SOP、计算协议

这类文档的共同特点：

- 标题层级清晰（`Input Options` → `SCF` → `Convergence` → `DIIS`）
- 参数、关键词、表格往往**成组出现**，不应被固定长度 chunk 从中间截断
- Agent 查的是「某个关键词在哪个章节、和哪些选项相关」，不是模糊语义相似
- 研究者读手册的方式就是：**先看目录 → 进子章节 → 读具体条目**

embedding 检索在开放域、语义模糊的问题上有用；grep 在精确匹配变量名时有用。但计算化学手册是典型的**「文档多、条目杂、层级清楚、面向专业读者」**场景——TreefyIt 的树结构检索更贴近实际用法。

受 [PageIndex](https://pageindex.ai) 启发，TreefyIt 做的是一个**人类和 Agent 都友好**的检索增强框架——不是传统 RAG，而是**树结构检索层**。

### 6. Search 是补充，不是主入口

TreefyIt 也支持 BM25 节点搜索（`forest/search`、`search/nodes`），但定位是**辅助**：

```text
主流程：overview → children → inspect
补充：  search → inspect
```

和传统 RAG「一切靠向量相似度」形成差异。

---

## 对比总结

| 维度 | 传统 RAG | TreefyIt |
|------|----------|----------|
| 核心数据结构 | 扁平 chunk 列表 | 层级知识树 |
| 检索方式 | 向量相似度 top-k | 树导航 + 可选 BM25 |
| 可解释性 | 弱（score + chunk 文本） | 强（路径、标题、节点、原件） |
| 文档结构 | 非第一等公民 | **第一等公民** |
| 产品形态 | 聊天 / 搜索 API | Agent 文档上下文后端 |
| 工具复杂度 | 中～高 | 极小（4 工具） |
| 部署 | 常依赖云向量库 | 本地优先，对称云端 |
| 最适合 | 开放域问答、语义模糊检索 | 计算化学 Agent 查手册、写输入、核对参数 |

---

## 计算化学场景：为什么不用传统 RAG

| 典型需求 | 传统 RAG 的问题 | TreefyIt 的做法 |
| --- | --- | --- |
| 「B3LYP 在这个软件里怎么写？」 | chunk 可能只含泛函名，缺少上下文和语法 | 导航到 `Methods → DFT → Functionals → B3LYP` 节点 |
| 「SCF 不收敛该调哪些参数？」 | 多个相关参数散落在不同 chunk，检索不全 | 先 `overview` 找 SCF 章节，再 `children` 展开子选项 |
| 「这个基组适用于什么元素？」 | 表格被切碎，行/列关系丢失 | 表格作为完整节点保留，整段 inspect |
| 「对比 VASP 和 ORCA 的 k-point 设置」 | 跨文档 chunk 难以对齐同一概念层级 | 每份手册各建一棵树，Agent 分别导航到对应章节 |
| 「引用 Agent 依据了手册哪一节？」 | 只有相似度 score，无法审计 | 返回 `tree_id` + 节点路径 + 章节标题 + 原件 |

典型 Agent 工作流：

```text
用户：帮我写一个 ORCA 的 opt+freq 输入，用 def2-TZVP

Agent：
  1. build_knowledge(orca_manual.html)     # 若尚未构建
  2. overview(tree_id)                     # 看手册顶层结构
  3. children → "Input Syntax" → "Geometry Optimization"
  4. inspect 具体关键词节点                 # 拿到完整语法和示例
  5. 生成输入文件，并注明引用的章节路径
```

---

## 和竞品的差异化一句话

```text
Dify / OpenAI File Search  →  「输入 query，返回 chunk」
AnythingLLM / NotebookLM     →  「让人和文档聊天」
LlamaIndex / LangChain       →  「开发者自建 RAG 框架」

TreefyIt                     →  「让任意 Agent 用 4 个工具获得可导航、可审计的文档记忆」
```

更完整的竞品分析见 [COMPETITIVE.md](./COMPETITIVE.md)。

---

## 适用场景（计算化学）

### 更适合 TreefyIt

- Agent 根据软件手册生成 / 修改输入文件（`.inp`、`.com`、INCAR、POSCAR 等）
- Agent 查参数含义、默认值、推荐取值范围
- 多份 HTML / MD 手册并存，Agent 需要跨软件对比同一概念（如 k-points、截断能、收敛阈值）
- 需要向研究者展示「Agent 引用了手册哪一节」——可审计、可复核
- 课题组内部 SOP、计算协议以 Markdown 维护，Agent 按章节执行
- 本地 / 集群部署，计算环境不出网，不想依赖云向量库

### 仍更适合传统 RAG

- 跨大量非结构化文本做开放域语义搜索（如海量 PubMed 摘要、无结构笔记）
- 文档本身没有标题层级（纯日志、聊天记录、raw output）
- 只需要「问一句、答一句」，不需要按章节导航和引用证据

---

## 核心设计原则

```text
Agent-first:        工具优先服务 Agent 工作过程中的文档参考
Human-readable:     知识结构必须让人也看得懂，方便检查、调试和信任
Explainable:        检索路径像人类读目录、翻章节，而不是只返回 embedding chunk
Tree before vector: 知识树是主检索界面，向量搜索只能作为补充
Evidence-oriented:  每次返回都带 tree_id、node_id、标题、来源文件等证据锚点
```

相关文档：

- [AGENTS.md](./AGENTS.md) — Agent 接入指南
- [MCP.md](./MCP.md) — MCP / Skill 集成
- [COMPETITIVE.md](./COMPETITIVE.md) — 竞品分析
