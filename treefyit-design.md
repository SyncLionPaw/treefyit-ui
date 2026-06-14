# TreefyIt — 首页产品设计

> **一句话定位**：把任意文档变成 Agent 可解释检索的结构化知识树。

TreefyIt 的侧重点不是“让人和文档聊天”，而是当 Agent 在工作过程中需要参考规范、论文、API 手册、产品文档或其它资料时，能方便、稳定、可解释地拿到相关内容。

产品应该呈现为一种 **AI 基础设施**：面向 Agent 优先，但人类也能看懂、检查和调试。检索方式要有类人感觉，也就是像人读目录、翻章节、查看段落一样逐步缩小范围，而不是只依赖 embedding RAG 返回一组黑盒相似 chunk。

核心原则：

- **Agent-first**：Build Service、MCP、Skill、Query 工具优先服务 Agent 工作流中的文档参考。
- **Human-readable**：知识树、Detail Tree、Preview、Replay 都要让人能理解 Agent 为什么拿到这些内容。
- **Explainable retrieval**：默认检索路径是 `overview -> children -> inspect`，保留树路径、节点标题、来源文件等证据。
- **Tree before vector**：树结构是主界面和主协议；向量/关键词检索可以作为后续补充，但不能替代可解释结构。
- **Density-aware graph**：Build Diagram、Chat Replay、Universe SVG 和背景方块墙都必须随节点数量自适应；数据层不能丢节点，但 canvas 在大图下必须允许 LOD/聚合渲染，节点多时通过限制交互图形数量、保留当前路径、缩小半径、减少默认 label、压缩背景卡片尺寸和 `fitView` 避免浏览器卡死。

### 统一数据 Guard

前端不允许在各组件里随意混用 `null`、`undefined`、`[]`、`|| fallback` 和不同空态文案。底层数据可以保留真实形态：

- 单个资源缺失用 `null`，例如 `currentBuild: BuildRecord | null`。
- 列表缺失统一归一化为 `[]`，例如 `knowledgeBases: KnowledgeBase[]`。
- 可选后端字段保留 `undefined`，但不能直接作为 UI 状态判断来源。

组件层必须优先消费 store 提供的派生 guard：

- `historyGuard`：历史记录的 `loading / error / empty / ready`。
- `buildGuard`：当前 build/tree 的 `loading / error / empty / ready`。
- `hasKnowledgeBases`、`hasActiveBuild`、`hasBuildTree`：布尔能力判断。
- `activeBuildTitle`、`activeBuildDescription`、`activeBuildNodeCount`：展示字段的统一 fallback。

UI 规则：

- Loading、Error、Empty、Ready 四种状态必须显式区分。
- 空态文案从 guard 读取，不在组件里重复写不同表达。
- 操作按钮在 guard 非 ready 时要禁用或给明确提示。
- JSON、Preview、Query、Chat Sidebar 等不直接展示 `null` 或 `undefined`。

***

## 0. 外部仓库参考边界：只参考风格与样式

参考项目：`/Users/bytedance/docs/PageIndex/treefyit`。

**重要原则：Layout、信息架构、页面切换方式全部以本文档当前设计为准。**

外部仓库是一个更传统的工具型前端。新版本不复用它的 layout，不把它作为产品结构基线，只把它作为**视觉风格、组件样式、微交互和状态表达**的参考。

### 我们自己的布局基线

当前产品结构仍然是：

| 层级       | 我们的设计                                              |
| -------- | -------------------------------------------------- |
| **表层**   | 三屏横滑：Build / Chat / Query，每屏 `100vw × 100vh`       |
| **默认首页** | Chat 屏，用户打开即进入对话，不经过传统 Landing                     |
| **深层**   | 按 `↓` 进入知识树宇宙，前景力导树 + 背景方块墙               |
| **导航**   | 顶部 Tab 控制三屏，进入宇宙后变成简化导航                            |
| **数据**   | 三屏与宇宙共享同一份知识库/知识树数据，但读取边界不同：Build 单树，Universe 全量森林 |

### 可以参考的样式方向

- **颜色气质**：整个表层以经典黑白为大主题；绿色只作为着重色和辅助色，用于按钮、active、状态和少量图谱节点。
- **卡片质感**：参考 `rounded 12–20px`、低对比描边、轻阴影、半透明 hover 背景。
- **控件样式**：参考 segmented control、solid primary button、ghost button、icon button、toggle switch；不使用浏览器默认 select/button 样式。
- **Dropzone 状态**：上传前使用普通实线卡片边框；hover / dragover 时参考旧仓库的轻抬升、边框高亮、图标缩放和绿色 file indicator，不使用炫目高光。
- **微交互**：参考 hover lift、click scale、toast slide-in、spinner、typing dots、skeleton loading。
- **主题系统**：参考 light / dark / system 三态主题变量，但布局和页面结构不跟随外部仓库。
- **全局统一**：Build 不再是特例；Chat、Query、导航和所有表层控件都沿用 Build 的 card、panel、tabs、dropzone、badge 风格。

***

## 0.1 UI 组件库与图标库选型

当前项目技术栈是 **Vue 3 + Vite + TypeScript + Pinia + Sass**。组件和图标选型必须服务我们的三屏横滑、宇宙层和高定制视觉，不引入强绑定布局或重主题包。

### 最终选型

| 类型                | 选型                      | 用途                                                            | 原因                                    |
| ----------------- | ----------------------- | ------------------------------------------------------------- | ------------------------------------- |
| **UI Primitives** | `reka-ui`               | Dialog、Popover、Tooltip、Tabs、Select、Switch 等无样式基础交互            | Vue 3 原生支持、无样式、可访问性好，不限制我们的视觉和 layout |
| **项目 UI 层**       | `Treefy UI` 自研 Sass 组件层 | Button、Panel、Card、Input、Dropzone、SegmentedControl、Toast 等业务组件 | 保持三屏与宇宙视觉统一，样式完全可控                    |
| **图标库**           | `lucide-vue-next`       | 全站功能图标、导航图标、状态图标、按钮图标                                         | 线性风格统一、体积轻、Tree-shaking 友好、Vue 组件化使用  |
| **图谱渲染**          | `@antv/g6`              | Build 的 Diagram、树/图交互、缩放拖拽、节点点击                               | 比手写 SVG 更适合结构图编辑和后续图谱交互扩展             |
| **品牌图形**          | 自绘 SVG                  | TreefyIt Logo、宇宙节点、方块墙、特殊品牌动效                                 | 避免通用图标库无法表达品牌气质                       |

### 明确不用

| 不采用                               | 原因                                    |
| --------------------------------- | ------------------------------------- |
| **Emoji 图标**                      | 跨平台渲染不一致、无法统一线宽/尺寸/颜色，不适合作为正式产品 UI 图标 |
| **Element Plus / Naive UI 等重组件库** | 默认视觉较强，容易覆盖我们的定制设计；当前产品更需要高自由度        |
| **Tailwind-only 方案**              | 当前项目已采用 Sass 变量体系，不引入额外原子类心智负担        |

### 图标使用规范

所有 UI 图标统一从 `lucide-vue-next` 按需导入：

```ts
import { Hammer, MessageCircle, Search, FileText } from 'lucide-vue-next'
```

组件中使用：

```vue
<Hammer :size="16" :stroke-width="2" aria-hidden="true" />
```

规范：

- **尺寸**：导航 `15–16px`，按钮 `14–16px`，空状态主图标 `48–64px`。
- **线宽**：默认 `2`，大图标可用 `1.5`，禁止混用填充 emoji。
- **颜色**：默认继承 `currentColor`，通过父级文本色控制。
- **可访问性**：纯装饰图标加 `aria-hidden="true"`；有语义的 icon button 必须有 `aria-label`。
- **状态图标**：成功用 `CheckCircle2`，处理中用 `LoaderCircle`，失败用 `CircleX`。
- **文件/知识树**：文件用 `FileText`，知识库用 `Database`，知识树/Logo 用 `Network` 或自绘 SVG。

### TreefyIt Logo 设计规范

TreefyIt 的正式 Logo 不使用通用图标库直接拼接，而是使用自绘 SVG / 矢量图形。它需要同时表达三个概念：`Tree`、`Knowledge`、`It`，并且在导航栏小尺寸下仍然清晰可读。

**核心创意**：

- **字标主体**：Logo 是文字标识 `TreefyIt`，整体为圆润、干净、现代的几何无衬线字标。
- **首字母 T**：大写 `T` 看起来像一棵椰子树，但仍必须清晰读作字母 `T`。
- **知识树隐喻**：这个椰子树不是真实自然树，而是由数学符号、知识符号和结构化符号堆叠出来的，象征“把知识变成树”。
- **T 的树干**：竖笔画由括号、积分符号、求和符号、斜杠、点、公式片段、小节点和连接线整齐堆叠形成。
- **T 的树冠**：横笔画由弯曲的数学符号、小节点、连接线和轻微展开的叶片形结构组成，像椰子树叶，也像知识图谱的分叉。
- **小写 i 的点**：`i` 上方的黄色点是一只圆润的小雀，作为温暖、灵动的品牌记忆点。
- **小雀风格**：小雀必须是抽象、Logo 化、极简的圆形小鸟，有极小鸟喙和简单翅膀，不做卡通化细节，也不使用 emoji 风格。

**颜色规则**：

| 部位          | 颜色                                  | 说明                |
| ----------- | ----------------------------------- | ----------------- |
| **主体字母**    | 黑 / 白，随主题切换                         | 保持经典黑白主视觉         |
| **T 知识椰子树** | 绿色 accent `#16A34A`，可辅以深绿 `#15803D` | 表达树、结构、生长和可检索知识   |
| **i 上方小雀**  | 温暖黄色，如 `#FACC15` / `#F59E0B`        | 只作为小面积品牌记忆点       |
| **背景**      | 透明或纯白 / 纯黑                          | 适配导航栏、favicon、启动页 |

**绘图提示词**：

```text
TreefyIt brand logo, clean vector wordmark, transparent or white background, modern minimal tech style.

Design the wordmark "TreefyIt". The capital letter "T" is shaped like a coconut palm tree while still clearly reading as the letter T. The palm tree is not a real organic tree: it is constructed by stacked mathematical and knowledge symbols, such as brackets, integrals, summation signs, nodes, tiny formulas, slashes, dots, and structured glyph blocks, symbolizing "turning knowledge into a tree". The trunk forms the vertical stroke of T, built from neatly stacked symbols. The palm leaves form the horizontal top stroke of T, made from curved mathematical symbols and small connected knowledge nodes.

The rest of the letters "reefyIt" are simple, rounded, black geometric sans-serif letters. The lowercase "i" has a yellow dot, and the dot is actually a tiny round soft bird, very minimal and cute, like a small plump sparrow perched above the i. The bird should be abstract and logo-like, with a tiny beak and simple wing shape, not cartoonish, not detailed, not emoji-like.

Color palette: black and white as the main theme, fresh green accent for the symbolic palm-tree T, warm yellow for the bird dot above i. Keep the design balanced, readable, elegant, playful but professional. Flat vector, no 3D, no gradients, no shadows, no complex background. High legibility at small sizes, suitable for website navbar, app icon, and favicon.
```

**落地要求**：

- 导航栏内默认使用横向 wordmark；空间不足时可只保留自绘 `T` 椰子树符号。
- favicon / app icon 可以抽取 `T` 知识椰子树 + 黄色小雀点作为组合符号。
- Logo 文件应优先输出为 SVG，保留可编辑路径，避免位图缩放失真。
- Logo 与 `lucide-vue-next` 图标系统并行存在：功能图标用 lucide，品牌 Logo 用自绘 SVG。

### 组件库分层

```
reka-ui primitives
       ↓
Treefy UI 基础组件（Sass 主题）
       ↓
业务组件：TopNav / ChatInput / BuildPanel / QueryPanel / UniversePopup
```

推荐组件封装：

| 组件                      | 基础能力                                                                          |
| ----------------------- | ----------------------------------------------------------------------------- |
| `TfButton`              | `primary / secondary / ghost / danger / icon`，支持 `leadingIcon / trailingIcon` |
| `TfIconButton`          | 统一尺寸、圆角、hover、`aria-label`                                                    |
| `TfPanel`               | 卡片/面板背景、描边、阴影、深浅主题                                                            |
| `TfInput`               | 文本输入、路径输入、搜索输入                                                                |
| `TfDropzone`            | dragover、file indicator、上传状态                                                  |
| `TfSegmentedControl`    | Build mode、Query tool、Format 切换                                               |
| `TfToast`               | 成功、错误、处理中反馈                                                                   |
| `TfTooltip / TfPopover` | 基于 `reka-ui`，样式走 Treefy UI                                                    |

### 技术方案参考边界

外部仓库不仅参考样式，也参考成熟交互和渲染技术，但落地时仍服务我们的 Vue 3 架构：

| 能力       | 参考点                                      | 我们的实现方案                                                                                     |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| **图谱渲染** | 参考其结构图工作台的工具化表达                          | Build `Diagram` 使用 `@antv/g6`，只渲染当前构建的一棵知识树，支持 autoResize、drag canvas、zoom canvas、drag node |
| **上传动效** | Dropzone hover / dragover 有轻抬升、边框变色、图标缩放 | 封装到 `TfDropzone`：初始实线卡片，交互态 `translateY(-2px)`、浅 accent 底、`dragover` 状态、统一 transition       |
| **面板切换** | 结果面板轻量 fade/slide，不做夸张动画                 | Tabs/Panel 只使用 `120–180ms` 过渡，避免页面跳动                                                        |
| **状态反馈** | Toast、Processing、History status 可见       | Build、Chat、Query 复用同一状态图标和 badge 规范                                                         |

G6 使用规范：

- **Build Diagram**：只展示当前构建的一棵树；节点颜色来自 source palette，节点点击同步选中状态。
- **Build Diagram 节点完整性**：Build 的数据源必须保留 `treeStore.buildFlatNodes` 全量节点；当节点数超过浏览器安全阈值时，G6 canvas 自动进入 LOD，只渲染 root/浅层节点、当前选中路径、children/兄弟节点和高信息量节点，完整树仍由 Detail Tree、JSON 和 Agent API 访问。
- **Build 节点拖拽**：Build 使用 `d3-force` 布局时必须配置 G6 `drag-element-force`，并设置 `fixed: true`，保证用户拖动后节点留在新位置，不被力导布局拉回。
- **Universe 深层**：仍可保留 D3/自研视差逻辑，因为宇宙层更偏沉浸视觉，不等同 Build 工作台。
- **数据结构**：Build 统一由 `treeStore.buildFlatNodes` 和 `treeStore.buildLinks` 转为 `{ nodes, edges }`；Universe 才使用全量 `flatNodes` / `links`。
- **生命周期**：Vue 组件内创建 `Graph`，监听 resize，组件卸载时必须 `destroy()`。

***

## 1. 核心架构：三层空间

整个产品由 **三个维度** 构成，从表到里：

```
        Y轴（纵深）按 ↓ ──► 潜入
        ▼
   ═════════════════════════════════════  ← 表层（工作区）
   │  ┌─────┐ ┌─────┐ ┌─────┐          │
   │  │Build│ │Chat │ │Query│  X轴横滑  │     Chat = 首页
   │  └─────┘ └─────┘ └─────┘          │
   ═════════════════════════════════════
                    │ 向下潜入
                    ▼
   ┌────────────────────────────────────┐
   │         前景：力导树                 │    ← 彩色圆节点 + 弱光连线
   │              ●                      │       悬浮在空间中段
   │           ╱  │  ╲                   │
   │          ●   ●   ●                  │
   │                                    │
   │  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊   │    ← 视差间距
   │                                    │
   │         背景：方块墙                 │    ← 不规则方形色块铺满
   │   ┌──┐┌────┐┌──┐  ┌──┐┌──┐        │       每块 = 一个树节点
   │   │  ││    │└──┘  │  ││  │  ┌──┐  │       前后进深错落
   │   └──┘│    │┌──┐  │  │└──┘  │  │  │       像一面知识照片墙
   │   ┌──┐└────┘│  │  └──┘┌──┐  └──┘  │
   │   │  │┌────┐└──┘  ┌──┐│  │  ┌────┐│
   │   └──┘│    │      │  │└──┘  │    ││
   │        └────┘      └──┘      └────┘│
   └────────────────────────────────────┘
              黑色宇宙 #0A0A0F
```

### 表层 — 三屏横滑

**首页 = Chat 屏。** 用户打开直接进入聊天界面，零门槛。

三个模式对应三个**全屏面板**，水平排列，通过顶部 Tab 整屏滑动切换：

```
         ◄─────────────────────────────────────────────►
    滑动方向        ↖ 向左           默认           向右 ↗

              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │          │  │          │  │          │
              │  BUILD   │  │  CHAT    │  │  QUERY   │
              │  (左屏)  │  │  (中屏)  │  │  (右屏)  │
              │          │  │  默认首页   │  │          │
              │          │  │          │  │          │
              └──────────┘  └──────────┘  └──────────┘
              ← off-screen    visible     off-screen →
```

### 深层 — 知识树宇宙

**三屏之下隐藏着一棵树。** 按 `↓`，如同视线穿透表层、
潜入黑暗宇宙，力导布局的彩色节点从虚空中浮现。

```
        ┌─── 表层工作区 ──────────────────────────────┐
        │  (Chat / Build / Query 三屏横滑)              │
        └─────────────────────────────────────────────┘
                          │
                          │  ↓ 键
                          │  表层像水面一样向上退去
                          ▼
        ┌─── 深层：知识树宇宙 ──────────────────────────┐
        │                                               │
        │              ·  ·    ·  ·                      │
        │          ·        (red node)        ·                  │
        │        ·      ╱  │  ╲       ·                  │
        │      (moss node)       (leaf node)     (sage node)       (teal node)                    │
        │     ╱ ╲     │    ╱ ╲     ╱ ╲                   │
        │   (white node)  (orange node)   (brown node)  (yellow node)   (red node)  (white node)                     │
        │        ·       ·        ·                      │
        │                                               │
        │          黑色宇宙 · 力导布局 · 彩色节点          │
        │                                               │
        └───────────────────────────────────────────────┘
```

**关键规则**：

- 每屏占满 `100vw × 100vh`，无滚动（内容区内部可滚动）
- 默认显示 **Chat（中屏）**，Build 和 Query 在左右两侧不可见
- 点击 Tab → `transform: translateX()` 平滑滑动，使用 `520ms cubic-bezier(0.22, 1, 0.36, 1)`
- 三个屏**共享同一份知识库数据**，只是交互方式不同
- **按 `↓`** → 退出表层，进入知识树宇宙

***

## 2. 导航栏（三屏共用）

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [Network] TreefyIt   [[Hammer] Build] [[MessageCircle] Chat] [[Search] Query]              │
│                         [Settings] [Moon/Sun] [Github GitHub] [BookOpenText Docs]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| 元素                | 说明                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Logo**          | \[Network]  TreefyIt，点击始终回到 Chat 屏                                                   |
| **模式 Tab**        | 三个等宽按钮横排，不使用小点；active 状态由一个滑动的绿色 accent 胶囊承载；点击触发横滑切换                                |
| **API 设置**        | 右上角 `Settings` 齿轮按钮，点击打开 API Settings 模态框，不在顶栏直接铺开 `Local / Cloud` 控件 |
| **主题切换**          | 单个 icon button，白色主题显示 `Moon`，黑色主题显示 `Sun`                                            |
| **GitHub / Docs** | 右上角图标链接：`Github` + GitHub、`BookOpenText` + Docs                                      |

导航固定在顶部（`position: fixed; top: 0`），背景半透明毛玻璃。
进入宇宙后导航中部变为简化版：Logo + 语义化 `Surface` 返回胶囊按钮，右侧保留 API 设置、主题切换和外链。

**右侧控件规范**：

- API 设置入口必须是轻量圆形齿轮 icon button，图标使用 `Settings`；默认不显示外圈圆角矩形描边，hover 只显示极浅背景和轻微强调。
- 点击齿轮后弹出居中模态框；模态框内用自定义卡片式选项选择 `Local / Cloud`，不使用 `<select>` 默认下拉外观。
- 选择 `Local` 时必须显示并校验用户自己的 `LLM Provider Base URL` 和 `LLM Provider API Key`；这不是 TreefyIt 后端地址。选择 `Cloud` 时不显示 URL / API Key 输入，仅展示托管服务说明。
- 模态框外层尺寸必须固定，不能因为 `Local` 和 `Cloud` 表单项目数量不同导致宽高、按钮位置或视觉重心跳变。
- 主题按钮为轻量圆形 icon button，默认不显示外圈圆角矩形描边，hover 与 API 设置按钮一致。
- 所有按钮点击后或被 `Enter` 触发后都不能残留浏览器默认 focus 外边框；按钮只保留产品定义的 hover / active / disabled 状态，不出现额外 outline。
- GitHub / Docs 必须同时显示图标和文字，图标来自 `lucide-vue-next`，尺寸 `14px`，继承文本色。
- 右侧控件整体间距固定，不能因为 API 运行模式切换导致导航宽度抖动。

**Tab 切联动效**：

- 点击 `Build` → 整体右滑，露出左屏
- 点击 `Chat` → 回到中屏
- 点击 `Query` → 整体左滑，露出右屏
- 当前 Tab 不使用生硬的颜色替换，而是一个 active 胶囊在三个 Tab 之间滑动
- 不使用 `●` 小点标记 active，避免内容宽度和视觉重心在切换时变化
- 胶囊切换时使用“变形果冻”效果：移动中短暂横向拉伸、纵向压缩，随后反向回弹到正常比例
- 点击按钮本身也要有 `duang` 反馈：先被压扁，再反向弹起；即使点击当前 active Tab 也必须有反馈
- 胶囊动画参数：位移 `520ms cubic-bezier(0.22, 1, 0.36, 1)`，果冻回弹 `420ms cubic-bezier(0.34, 1.56, 0.64, 1)`
- 三个 Tab 固定等宽，active 胶囊独立于按钮文本层，避免切换时文字宽度造成抖动
- 支持键盘 `←` `→` 快捷键切换
- 支持触控板双指横滑

***

## 3. 知识树宇宙（深层视图）

> 三屏是工作台，宇宙是真相。
> 按 ↓，你就看到了那棵树真正的样子。

### 概念

用户在任意一屏按 `↓`，表层工作区像水面一样
向上退去，视野沉入一片**深黑宇宙空间**。Universe 保持正面沉浸视角，不使用斜俯视相机；用户应看到前景节点网络，以及在后方一定距离处完整渲染的实体方块墙。空间的纵深分为两层：

```
     视线方向 ──────────────────────────────────►

     ┌─────────────────────────────────────────────────────┐
     │                                                     │
     │   前景层：力导树                                      │
     │   彩色圆形节点 + 弱光连线，漂浮在空间中段                │
     │   可拖拽、缩放、hover 查看详情                         │
     │                                                     │
     │                  ●                                   │
     │              ╱   │   ╲                               │
     │            ●      ●      ●                           │
     │           ╱ ╲    ╱ ╲    ╱ ╲                          │
     │          ●   ●  ●   ●  ●   ●                        │
     │                                                     │
     │   ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊               │  ← 纵深间隔
     │                                                     │
     │   背景层：方块墙                                      │
     │   不规则排列的彩色方块，前后有进深差                     │
     │   每个方块 = 一个树节点，像一面照片墙铺满背景             │
     │                                                     │
     │   ┌──┐┌────┐┌──┐  ┌──┐┌──┐                          │
     │   │  ││    │└──┘  │  ││  │  ┌──┐                    │
     │   └──┘│    │┌──┐  │  │└──┘  │  │                    │
     │   ┌──┐└────┘│  │  └──┘┌──┐  └──┘                    │
     │   │  │┌────┐└──┘  ┌──┐│  │  ┌────┐┌──┐             │
     │   └──┘│    │┌──┐  │  │└──┘  │    ││  │             │
     │        └────┘│  │  └──┘┌──┐  └────┘└──┘             │
     │              └──┘      │  │                          │
     │                        └──┘                          │
     │                                                     │
     └─────────────────────────────────────────────────────┘
```

- **前景**：力导布局树（force-directed graph），节点渲染视觉对齐 Build Diagram：彩色圆形节点、白色描边、按 depth 递减的尺寸、低阴影、弱连线、可开启/关闭 label
- **背景**：方块墙（block wall），不规则排列的方形实体卡片，是远处背景层，不与前景节点处于同一图层
- **数据**：两层共享同一棵知识树——每个节点在前景是一个圆，在背景是一个方块

### 进入与退出

| 操作                        | 行为                            |
| ------------------------- | ----------------------------- |
| **`↓`** | 表层上移 + 渐隐，宇宙层从底部渐入，\~600ms 过渡 |
| **`↑`** **/** **`Esc`** | 直接退出宇宙 |

Universe 进入/退出不再绑定滚轮或触控板纵向滑动，避免用户只是翻看 Chat 记录时误入深层视图。滚轮只用于页面内部滚动或 Universe 前景图谱缩放；Universe 切换只使用键盘方向键和 `Esc`。

**过渡动效**：

```
时间线：
0ms          200ms              600ms
 │            │                  │
 ▼            ▼                  ▼
表层 ████████░░░░░░               表层完全透明（opacity: 0）
              ░░████████████████  宇宙从模糊到清晰（blur→sharp + opacity 0→1）
              节点从中心向外扩散展开（scale 0.3 → 1）
              连线逐渐亮起
```

退出时反向：节点向中心收缩 + 淡出，表层回落。

### 空间构成

```
┌─────────────────────────────────────────────────────────────┐
│  [Network]  TreefyIt        [← Surface]              [GitHub][Docs]│  ← 简化顶栏
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ╔══╗╔════╗╔══╗  ╔══╗╔══╗          ← 方块墙背景           │
│   ║  ║║    ║╚══╝  ║  ║║  ║  ╔══╗    每块 = 一个树节点      │
│   ╚══╝║    ║╔══╗  ║  ║╚══╝  ║  ║    前后进深错落            │
│   ╔══╗╚════╝║  ║  ╚══╝╔══╗  ╚══╝    颜色按文档分配          │
│   ║  ║╔════╗╚══╝  ╔══╗║  ║  ╔════╗                         │
│   ╚══╝║    ║╔══╗  ║  ║╚══╝  ║    ║                         │
│        ╚════╝║  ║  ╚══╝╔══╗  ╚════╝                         │
│   ┊        ┊ ┊  ┊     ┊ ┊  ┊   ┊  ┊  ← 纵深间距            │
│   ┊        ┊ ┊  ┊     ┊ ┊  ┊   ┊  ┊                        │
│                          ●                                  │
│                     ╱   │   ╲        ← 力导树前景            │
│                  ●      ●      ●    彩色圆节点 + 连线        │
│                 ╱ ╲    ╱ ╲    ╱ ╲    悬浮在方块墙前方        │
│               ●    ● ●    ● ●    ●                         │
│                                                             │
│         ┌─────────────────────────────────┐                 │
│         │  hover 浮层（前景节点 & 背景方块）│                 │
│         │  [FileText]  POST /parse                 │                 │
│         │  来源: api.pdf · P.12           │                 │
│         │  Token: 342                     │                 │
│         │  [[Clipboard]  复制路径]  [[MessageCircle]  跳转Chat]    │                 │
│         └─────────────────────────────────┘                 │
│                                                             │
│  ── 42 节点 · 3,200 tokens · 3 文档 · Labels · [↑] · 拖拽平移 · 滚轮缩放 ──│  ← 底部状态栏
└─────────────────────────────────────────────────────────────┘
```

### 前景节点渲染

Universe 仍使用 D3 / 自研力导逻辑承载沉浸式森林视角，但前景节点的视觉语言必须向 Build 的 G6 Diagram 对齐，避免 Build 和 Universe 像两个不同产品。

| 项目 | 规则 |
| --- | --- |
| **节点形状** | 圆形节点，与 Build Diagram 保持一致，不使用 emoji 或复杂图标 |
| **节点尺寸** | 按 `depth` 递减，接近 Build 的 `Math.max(16, 34 - depth * 4)` 直径规则；Universe 不再主要按 token 数放大节点 |
| **节点颜色** | Universe 不直接照搬全绿色 source palette，而是使用 `UNIVERSE_DEPTH_PALETTE` 按 `depth` 分配层级色；每个层级色再混入主图节点的 `node.color`，让宇宙能跟随当前知识树/主图配色变化 |
| **描边与阴影** | 使用白色描边和低强度阴影；禁止高亮 glow 和霓虹效果 |
| **Label** | 默认开启，显示在节点上方，文字截断到 16 个字符；hover / selected 时增强亮度和字重 |
| **Label 开关** | 底部状态栏提供 `Labels` switch，状态存入 `uiStore.isUniverseLabelsVisible`；关闭后只隐藏 label，不销毁节点、不重排力导图 |
| **交互** | 保留拖拽平移、滚轮缩放、节点 hover 详情和点击选中；节点视觉状态与 Build 的 hover/selected 反馈保持一致 |

Universe 配色边界：

- **不同层级不同颜色**：root 可以是绿色，后续层级可以切到 teal / blue / violet / amber / coral / lime / cyan，表达结构深度，而不是整张宇宙图都绿色。
- **跟随主图变色**：Universe 颜色不是写死的纯 depth 色；实际显示色由 `universeNodeColor(node)` 计算，使用 `depth` 色作为基底，并混入 `node.color`，所以当主图 source palette 或节点色变化时，宇宙也会一起变。
- **前景与远景一致**：`ForceGraph` 前景节点、`BlockWall` 远景方块、`NodePopup` 高亮边框必须使用同一套 Universe 颜色计算，避免 hover 后颜色跳变。
- **主题边界**：表层主题仍然是黑/白可切换；Universe 始终保持深色空间，只改变节点/方块/浮层强调色，不改变大背景。

### 背景：黑色宇宙

```
最底层:    #0A0A0F  (近纯黑，微微带蓝)
星尘粒子:  随机分布的微小白色光点（Canvas / WebGL 粒子）
          数量 ≈ 200，大小 0.5–2px，opacity 0.1–0.4
          缓慢漂移（每帧位移 < 0.5px）
深空雾:    1–2 个极淡的径向渐变色斑（紫 #1a0a2e、蓝 #0a1a2e）
          opacity 0.15，营造空间纵深感
```

### 方块墙（远景背景层）

方块墙是宇宙空间的**远景背景**，铺满整个视野，位于力导树的显著后方。
每个方块对应知识树中的一个节点，但它只承担空间氛围和知识规模感，不承担主要交互。

**外观**：

```
     远景墙面整体位于前景力导图后方
     ◄──────────────────────────────►

     opacity 0.12         opacity 0.2

     ┌──┐┌────┐┌──┐      ┌────┐┌──────┐
     │  ││    │└──┘  ┌──┐│    ││      │  ← 远处：小、暗、模糊
     └──┘│    │┌──┐  │  │└────┘│      │
     ┌──┐└────┘│  │  └──┘┌──┐  │      │  ← 近处：大、亮、清晰
     │  │┌────┐└──┘  ┌──┐│  │  └──────┘
     └──┘│    │┌──┐  │  │└──┘  ┌────┐
          └────┘│  │  └──┘┌──┐  │    │
                └──┘      │  │  └────┘
                          └──┘
```

**方块属性**：

| 属性     | 规则                                          |
| ------ | ------------------------------------------- |
| **大小** | `72–120px` 正方形（或近似正方形的矩形），大小 ∝ `tokenCount` |
| **颜色** | 使用与 Universe 前景节点一致的 `universeNodeColor(node)`，以层级色为主、混入主图节点色；填充色和描边都要可见，不做几乎透明的白块 |
| **圆角** | `4–8px`，微圆角                                 |
| **间距** | 方块之间 `4–12px` 不等，不规则的间隙                     |
| **排列** | 类似瀑布流 / 砖石布局（masonry），但带有 Z 轴位移             |
| **存在感** | 方块墙位于后方，但必须能明确看到“远处渲染了一整面节点卡片墙”；默认 opacity 不应低于约 `0.28`，整体 group 可保持 `0.7` 左右透明度，避免弱到像噪点背景 |

**进深差（Z 轴）**：

```
进深由节点的 depth + tokenCount 决定：

  所有方块整体位于远处背景层，不允许前凸到前景节点所在图层。

  远景方块:   opacity 0.12–0.2,  无主发光,  scale 0.7–0.8
  前景节点:   opacity 1.0,       发光连线,  可 hover / click
```

**方块表面内容**：

```
┌──────────────────┐
│                  │
│  POST /parse     │   ← 节点标题（白色文字）
│                  │
│  api.pdf · P.12  │   ← 来源（小字，低 opacity）
│                  │
│  ████░░ 342 tkn  │   ← token 比例条（微型可视化）
│                  │
└──────────────────┘

远处方块（opacity 0.15）只隐约显示标题
远景方块只隐约显示标题和来源，不作为主要阅读对象
```

**方块墙的动效**：

| 动效       | 说明                                   |
| -------- | ------------------------------------ |
| **微浮动**  | 整面墙以极低频缓慢飘移（`translate` ±2px，周期 8s）  |
| **呼吸光**  | 默认不做强发光，只保留极弱透明度变化，避免抢前景力导图层级        |
| **新增方块** | Build 构建新知识库 → 方块从透明渐入，从墙的随机位置 "长出来" |
| **删除方块** | Build 中删除节点 → 对应方块碎裂/淡出，周围方块平滑填补间隙   |
| **视差滚动** | 鼠标移动时方块墙与力导树有不同的视差位移量，强化纵深           |

**方块墙与力导树的视差关系**：

```
鼠标向右移动时：

  前景（力导树）:  → 平移 20px
  背景方块墙:      → 平移 2–3px  ← 很慢，体现它在远处

  形成“前景图谱悬浮在远景墙前”的纵深感
```

**Hover 交互（方块）**：

背景方块墙不参与主要 hover / click。节点详情、复制路径、跳转 Chat 等交互全部发生在前景力导图节点上。

**技术实现建议**：

```css
/* 方块墙用 CSS 3D Transform 或 Three.js 实现 */
.wall-container {
  perspective: 1200px;
  transform-style: preserve-3d;
}

.block {
  /* 每个方块 */
  border-radius: 6px;
  transition: transform 300ms ease, opacity 300ms ease;

  /* 进深差 */
  transform: translateZ(var(--z-depth));  /* -200px ~ +50px */
}

.block:hover {
  transform: translateZ(calc(var(--z-depth) + 30px));
  opacity: 0.8;
}
```

### 节点设计

**外观**：

```
         ┌──────────────┐
         │    ──────     │   ← 外圈：半透明发光环（glow）
         │   ╱    ╲      │       颜色 = 节点主色 + opacity 0.3
         │  │  (red node)  │     │   ← 核心：彩色实心圆
         │   ╲    ╱      │       直径 ∝ tokenCount（20–60px）
         │    ──────     │
         └──────────────┘
          节点标题文字      ← 节点下方白色小字，opacity 0.7
```

| 属性     | 规则                                          |
| ------ | ------------------------------------------- |
| **颜色** | 按**来源文档**分配：每个文档一个色相（自动从 12 色板中取）           |
| **大小** | 直径 ∝ `tokenCount`，最小 20px，最大 60px           |
| **标签** | 节点下方显示 `title`，白色小字，opacity 0.7             |
| **发光** | 同色外圈 `box-shadow` 或 SVG filter，`blur: 12px` |
| **动效** | 力导布局微振动（`alpha > 0`），节点始终在缓慢浮动              |

**颜色分配**（按文档自动取色）：

```
doc1.pdf → (red node) #FF6B6B  (珊瑚红)
doc2.md  → (blue node) #4ECDC4  (青绿)
doc3.pdf → (mint node) #34D399  (辅助薄荷绿)
doc4.zip → (lime node) #A3E635  (电感 lime)
...      → 循环 12 色板
```

**悬停交互（Hover）**：

鼠标悬停节点 → 节点放大 1.3× + 发光增强 + 弹出浮层：

```
┌──────────────────────────────┐
│                              │
│  [FileText]  POST /parse              │  ← 标题
│  来源: api.pdf · P.12        │  ← 来源文件 + 页码
│  Token: 342                  │  ← token 数
│                              │
│  Parse a document into a     │  ← 内容摘要（前 120 字）
│  structured tree...          │
│                              │
│  [[Clipboard]  复制路径]  [[MessageCircle]  Chat]     │  ← 操作按钮
│                              │
└──────────────────────────────┘
```

- `[Clipboard]  复制路径` → 复制 `/api-reference/endpoints/POST-parse` 到剪贴板
- `[MessageCircle]  Chat` → 退出宇宙，回到 Chat 屏，自动发送 "讲讲 POST /parse"
- 浮层不能在鼠标离开节点的瞬间消失；节点 `mouseleave` 后应延迟关闭，且鼠标进入浮层时取消关闭计时，确保用户可以移动到浮层内复制路径或点击 Chat。
- 浮层离开后再关闭；如果用户 hover 到新的节点，则立即切换为新节点内容。

### 连线设计

```
父子连线:  白色/灰色细线，opacity 0.15
           线宽 1px，从父节点中心连到子节点中心
           直线（力导布局自然形成美感）

跨文档关联: 虚线，opacity 0.08
           语义相近的节点间自动生成
           只在 hover 某节点时短暂高亮

连线动效:   alpha 衰减过程中，连线实时跟随节点运动
           最终静止后连线微颤（alpha > 0.005）
```

### 力导布局参数

```javascript
// d3-force / 类似库配置参考
{
  center:     { strength: 0.05 },          // 整体居中
  charge:     { strength: -120 },           // 节点互斥
  link:       { distance: 80, strength: 0.3 }, // 父子连线弹力
  collide:    { radius: 40, strength: 0.8 },   // 防重叠
  alpha:      0.3,                          // 初始能量（低→平稳）
  alphaDecay: 0.005,                        // 缓慢冷却，保持微振动
}
```

- 首次进入时从 `alpha: 1` 开始，节点从中心爆炸式展开 → 300ms 内稳定
- 之后保持 `alpha > 0.005`，节点持续微微浮动
- 新增节点时局部 reheating，只影响附近节点

### 导航与操作

| 操作       | 行为                             |
| -------- | ------------------------------ |
| **拖拽节点** | 使用 `drag-element-force` 固定该节点新位置，不能被力导布局拉回 |
| **拖拽空白** | 平移整个画面                         |
| **滚轮**   | 缩放（0.3× – 3×）                  |
| **双击节点** | 展开/收起子树（折叠时子节点缩入父节点）           |
| **点击节点** | 选中 → 高亮该节点 + 所有祖先 + 子女，其余变暗    |
| **右键节点** | 上下文菜单：复制路径 / 跳转 Chat / 编辑 / 删除 |

### 与三屏的数据联动

```
          知识树宇宙（深层）
          ┌──────────────┐
          │  力导可视化    │
          │  彩色节点      │
          │  hover 详情    │
          └──┬─────┬─────┬┘
             │     │     │
          Build  Chat  Query    ← 表层三屏
          编辑    对话   检索

  共享同一份 树结构 JSON 数据源
```

- 宇宙中**点击节点 → 跳转 Chat** 追问该节点内容
- 宇宙中**点击节点 → 跳转 Query** 自动填入该节点路径
- **Build 中编辑树** → 宇宙实时更新（新增节点渐入，删除节点淡出）
- **Build 构建新知识库** → 宇宙中新的子树从中心展开

***

## 4. 中屏 — Chat（首页 / 落地页）

> **这就是用户看到的第一个页面。** 无 Hero，无 Landing，直接就是可用的 Chat。

```
┌─────────────────────────────────────────────────────────────┐
│  [Network] TreefyIt [[Hammer] Build] [[MessageCircle] Chat] [[Search] Query] [Local][Cloud] [Moon] [Github GitHub] [BookOpenText Docs]│
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  [Database] 知识库         │                                              │
│              │                                              │
│  当前知识库    │      Hi! 选择知识库后就可以直接提问。                  │
│  ──────────  │    ┌────────────────────────────────────────┐ │
│ Product Docs │    │ Chat 只负责对当前知识库提问。              │ │
│ 4 docs · 42 nodes │    │ 上传和构建请切到 Build。                 │ │
│              │    └────────────────────────────────────────┘ │
│              │                                              │
│  ──────────  │                         ┌────────────────────┐ │
│              │                         │ doc1 的第三章讲了什么？ │ │
│  可切换知识库  │                         └────────────────────┘ │
│              │                                              │
│              │    ┌────────────────────────────────────────┐ │
│  Product Docs │    │ 第三章 "架构设计" 主要讨论了：               │ │
│  Design Notes │  │                                        │ │
│  Research Vault │  │  1. 系统整体架构图（微服务 + 事件驱动）   │ │
│              │  │  2. 核心组件划分：Parser / Builder / API │ │
│              │  │  3. 数据流：文档 → 解析 → 树 → 索引     │ │
│              │  │                                        │ │
│              │    │ [FileText] doc1.pdf · 第三章 · P.23-31 │ │
│              │    └────────────────────────────────────────┘ │
│              │                                              │
│              │                                              │
│              │                                              │
│              │  ([Database]) [[Input] 输入消息，按 Enter 发送      ] [SendHorizontal] │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 左侧知识库面板（统一 330px）

| 区域         | 说明                                                   |
| ---------- | ---------------------------------------------------- |
| **统一宽度**   | Chat 知识库栏使用 `330px`，与 Build 左栏、Query 右栏同宽，保证跨屏空间关系稳定 |
| **不做手动收缩** | 移除侧栏收缩按钮，避免三屏切换时结构忽宽忽窄；Chat 仅保留输入态自动吸附               |
| **当前知识库**  | 知识库 Tab 中显示当前绑定知识库名称、描述、docs 数和 nodes 数；长文件名、描述和 meta 必须单行 `overflow: hidden` + `text-overflow: ellipsis`，不能撑出侧栏；不选择知识库时 Chat 仍可作为普通对话入口直接发送 |
| **知识库列表**  | 知识库 Tab 只提供知识库切换，不展示文档库、文件列表或树节点预览                           |
| **聊天记录**   | 同一卡片内提供 `知识库 / 聊天记录` Tab 切换；聊天记录 Tab 展示当前会话消息摘要、角色、时间和生成状态，完整过程仍通过 Replay 播放器查看 |
| **职责提示**   | 明确 Chat 只负责提问，上传、解析、构建统一在 Build 完成                   |

输入态收缩规则：

- 当 Chat 输入框获得焦点或已有输入内容时，左侧知识库面板进入 `docked` 状态。
- `docked` 状态不是侧栏收缩按钮，而是输入态自动动效：完整知识库面板向下收缩，吸附进输入胶囊最左侧。
- docked 控件必须真实渲染在 `ChatInput` 的 `.input-row` 内部，作为输入胶囊的第一个 flex 子项，不能再用相对屏幕的绝对定位去模拟塞入效果。
- docked 控件使用同心圆设计：外圈细描边、内圈弱底、中心绿色点；不再显示 `Database` 图标。
- 输入胶囊左侧在 typing 状态通过内部 flex 布局自然让位，避免同心圆遮挡文本输入，并保证不同分辨率下都不会跑到输入框外。
- 吸附状态存放在 `uiStore.isChatKnowledgeDocked`，顶部切换 Build / Query / Chat 时必须保留。
- 输入框 blur 不自动取消吸附；用户点击同心圆按钮时才展开完整知识库面板。
- 吸附动画使用 `560–620ms cubic-bezier(0.22, 1, 0.36, 1)`，完整面板到输入胶囊内部同心圆按钮必须是平滑位移和尺寸变化，不能突然跳变。

### 对话消息层

- **对话区无外框背景**：中间 Chat main 不再使用白色大卡片、描边或阴影，消息直接漂浮在黑白主题页面背景上。
- **不显示头像**：AI 和用户消息都不使用头像或圆形 icon，只通过气泡位置、颜色和来源标注区分角色。
- **悬浮气泡**：AI 气泡使用半透明白底、轻阴影和轻 blur；用户气泡使用绿色 accent 实色和轻阴影。
- **字体统一**：正文统一使用 `$font-size-md` / `$font-weight-regular` / `$line-height-relaxed`，只在来源、code、label 使用小一号 token。

**空状态**（首次进入 / 暂无对话）：

```
┌──────────────┬──────────────────────────────────────────────┐
│              │                                              │
│              │                                              │
│  Product Docs │                                              │
│              │         [Network]                                    │
│              │                                              │
│              │    向当前知识库提问                            │
│  Design Notes │                                              │
│              │    左侧切换知识库，底部输入问题。               │
│              │    上传和构建请前往 Build。                    │
│              │                                              │
│              │    [Database] Product Docs                  │
│              │                                              │
│              │                                              │
│              │  ([Database]) [[Input] 输入消息，按 Enter 发送      ] [SendHorizontal] │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- 空状态时聊天区只显示简短引导文案和当前知识库 pill，不出现上传 Dropzone；未选择知识库时仍允许直接聊天，选择知识库后再自动附带当前 build `bid` 做知识库问答。
- 底部输入框始终可见，只负责纯文本提问；文件上传回到 Build 处理。
- Chat 左侧不会显示文件解析进度；知识库构建状态在 Build / Query 里表达。
- Chat 气泡内容必须使用成熟 Markdown 渲染库渲染，当前选型为 `markdown-it` + KaTeX：多余连续空行归并，正文 trim，开启 linkify、typographer，并支持 GFM 表格、删除线、代码块、列表、标题、行内公式 `$...$` 和块级公式 `$$...$$` 等标准能力；表格要渲染为真实 `<table>`，公式要渲染为 KaTeX DOM，不能直接把 Markdown/LaTeX 原文展示给用户。
- Chat 主区域右上角提供 `Replay` 胶囊按钮；有对话记录时可打开播放器式回放模态框。

### 底部输入区（输入 + 发送）

```
      ([Database])  [[Input]   输入消息，按 Enter 发送             ] [SendHorizontal]
```

- **无上传入口**：不显示 Paperclip，不支持把文件拖进对话输入框，避免 Chat 和 Build 职责混淆。
- **状态栏式输入胶囊**：输入区域复用 Universe `footer.universe-status` 的视觉语言，使用居中的半透明胶囊、细描边、`backdrop-filter` 和横向对齐；不再使用大块底栏或顶部边线。
- **发送方式**：按 `Enter` 或点击右侧 `SendHorizontal` 按钮发送；`Shift + Enter` 预留给后续多行输入。
- **按钮规格**：发送按钮为紧凑圆形主按钮，放在胶囊内部右侧；不额外显示外圈圆角矩形描边；无内容时 disabled，避免空消息。
- **按钮位置**：发送按钮固定在输入框右侧，间距 `10px`；输入框、发送按钮和吸附按钮需要在视觉中心线上对齐。
- **禁用态**：无输入内容时发送按钮使用浅中性色底、弱文字色和 `0.55` opacity，不出现绿色 active 状态。
- **宇宙提示条**：`↓` 提示必须放在 `chat-main` 内、输入框上方，并相对输入框/对话内容区居中；不能按整屏 `50%` 绝对居中，否则会被左侧知识库栏挤歪。提示条右侧必须提供关闭按钮，关闭状态存入 `uiStore.isUniverseHintDismissed`，切换三屏后不自动恢复。
- **职责边界**：上传、解析、构建统一发生在 Build；Chat input 只负责问题文本。
- **输入态吸附**：打字时知识库选择器变成输入胶囊内部最左侧的同心圆按钮，中心是绿色点，降低左侧栏对对话注意力的占用。

### 外部样式参考 — Chat 状态表达

Chat 的整体 layout 仍采用本文档的“首页 Chat 屏 + 底部全宽输入框”。外部仓库只参考以下组件状态和视觉反馈：

| 能力            | 设计要求                                                     |
| ------------- | -------------------------------------------------------- |
| **拖拽状态**      | Chat 不处理拖拽上传；文件拖拽状态只出现在 Build Dropzone                   |
| **上传进度**      | 上传和解析时显示遮罩 + progress bar / spinner + “Processing...” 文案 |
| **知识库卡片**     | 卡片样式可参考外部仓库，但 Chat 左侧只展示知识库，不展示文件历史                      |
| **Chat 可用状态** | 未选择知识库时输入框仍可直接发送普通对话；选择知识库后 placeholder 切换为面向当前知识库提问，并在请求中附带当前 build `bid`         |
| **回答上下文**     | AI 回答尾部标注 `Based on document structure` 或具体来源路径          |

宇宙节点点击“跳转 Chat”时，仍回到我们的 Chat 屏，并自动带入问题：`讲讲 {node.title}`。

### 对话回放播放器

- 回放入口放在 Chat 主区域右上角，使用轻量 `Replay` 胶囊按钮，不占用输入区和消息流宽度。
- 回放以模态框呈现，结构像播放器：不使用占高的标题区，关闭按钮悬浮在右上角，顶部只保留细进度条，底部上一帧 / 播放暂停 / 下一帧控制；整体尺寸要给右侧 canvas 足够宽高，避免树图被压缩。
- 模态框左侧是缩小版对话气泡流，按消息和工具调用顺序逐步出现，气泡仍使用 Markdown 渲染，但尺寸更紧凑；长标题、长代码、长 inline code、表格必须被约束在气泡内，使用 `overflow-wrap` / `pre-wrap` / 横向滚动，不能撑出气泡。
- 模态框右侧是工具调用的可视化解释区：除了 G6 canvas 节点图，不展示标题、当前节点名或说明文字；必须使用和 Build Diagram 同一套 `@antv/g6` canvas 渲染管线，按真实 `TreeNode.children` 生成树边，并使用稳定的树形锚点坐标：root 在上、children 向下，leaf / level 间距足够大，不能被 force 聚拢成一坨散点云。
- 回放树节点默认以白色或透明色为主且不显示 label，保持低存在感，只让层级结构可读；随着工具使用，当前命中的节点必须亮起为橙色，并且只给命中节点显示短 label，祖先链做弱橙色提示，帮助用户理解 Agent 正在树上的哪个位置探索。
- 工具定位到节点时，右侧 G6 图必须把命中节点平滑移动到 canvas 中心；如果当前步骤没有具体节点，只保持整图概览。
- 回放树的数据不能裁剪 children 或 tree 数量；大树的 G6 canvas 必须进入 LOD，优先保留工具命中节点、祖先链、children、兄弟节点和浅层概览，避免一次渲染 1000+ 节点导致浏览器卡死。
- 工具事件优先根据 `arguments` 中的 `path` / `id` 定位当前探索节点，必要时再从 `result` 的 `path=`、`children of`、`[0.1]` 等显式路径里提取；没有具体路径的 overview 工具不应默认把根节点染成橙色。
- 如果当前是无知识库普通聊天，右侧显示空态说明，播放器仍能回放对话气泡。

***

## 5. 左屏 — Build（知识库构建）

> 点击 `Build` Tab → 整体向右滑动，露出左屏。

```
┌─ Build ─────────────────────────────────────────────────────┐
│ ┌─ Sidebar ───────┐ ┌─ Main ───────────────────────────────┐ │
│ │ Drop .md/.pdf   │ │ [Diagram] [Detail Tree] [Preview]    │ │
│ │ Parsing mode    │ │                                      │ │
│ │ Model           │ │ paper.md                             │ │
│ │ Summary toggle  │ │ 22 nodes · 24.6k in · 3.1k out       │ │
│ │ [Build Tree]    │ │                                      │ │
│ │ History         │ │ ┌─ Single Tree Canvas ─────────────┐ │ │
│ │ sample 9 nodes  │ │ │ current knowledge tree only       │ │ │
│ │ paper 22 nodes  │ │ └───────────────────────────────────┘ │ │
│ └─────────────────┘ └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Build 样式基准

Build 这一屏以参考项目截图为准，定位是**浅色构建工作台**，不再使用原来的文件管理树编辑器样式。

| 区域             | 设计要求                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **左侧栏**        | 固定 `330px`，与 Chat 知识库栏、Query 右侧参数栏保持一致；包含 Dropzone、Parsing mode、Model、Summary toggle、Build Tree、Build progress、History |
| **Dropzone**   | 上传前是白底实线卡片，不使用虚线；hover / dragover 时只做浅绿色底、主色边框和图标轻微放大，不做炫目高光                                            |
| **参数卡片**       | 白底卡片，小号 uppercase label，控件紧凑，不做复杂说明                                                                     |
| **Build Tree** | 单一主按钮，使用绿色 accent，不使用大面积复杂渐变；未选择/拖入文件时按钮 disabled 并显示 `Select a file`，文件进入 Dropzone 后才切换为可点击的 `Build Tree` |
| **Build progress** | 优先消费 `POST /api/build/stream` 的 NDJSON 事件展示真实进度；旧服务缺少流式接口时回退 `POST /api/build` 等待态。进度占用 `Build Tree` 按钮位置，只用一条细进度条 + 三个不同颜色小点表达阶段：上传绿、解析蓝、构建橙；进度条填充色必须跟当前阶段小灯颜色一致；构建结束后立即让出位置恢复 `Build Tree` 按钮，不使用大面积遮罩、标题卡片或阶段文字列表 |
| **History**    | 轻量历史列表，每项显示文件名、绿色 nodes badge、解析模式摘要                                                                    |
| **主内容顶部**      | 结果 Tabs 放在顶部：Diagram / Detail Tree / Preview / JSON                                                     |
| **知识树信息行**     | 高度控制在约 `60px`；左侧显示当前知识库/当前构建树名称，中间是横向 `nodes / tok in / tok out` tipbar，时间放在最右侧弱提示，不显示耗时和 model                                                          |
| **主画布**        | 大白色 canvas card，圆角、细边框、轻阴影，内部只展示当前构建的一棵树                                                                |

样式边界：

- **不要**增加额外渐变背景、Stats Row、复杂底部操作栏或多余配置区。
- **不要**把 Build 做回普通文件管理列表；左侧应是构建控制台。
- **不要**在 Build 里渲染森林。Build 是单棵知识树工作台，多知识库/多树的森林感只能在 Universe 深层查看。
- **可以**保留我们的三屏横滑容器和全局导航，但 Build 屏内部视觉对齐参考图。
- **颜色**以黑白中性色为主体，绿色只用于强调和辅助，避免页面“一片绿”。
- **进度语义**必须清楚区分“上传请求已发出”和“后端解析/构建仍在进行”。新后端提供 `POST /api/build/stream` 时，`save_original / save_original_done / parse / parse_done / structure / md_parsed / semantic / structure_done / refine / thin / thin_done / summarize / verify / verify_done` 会映射到现有三阶段 UI；后端 `message` 只作为调试信息，前端展示必须按 `stage` 本地化并可补充 `chars / nodes / node_count / done / total / score`；若接口不可用，前端只能回退旧 `/api/build` 的等待态乐观进度。

### 结果视图

| Tab             | 内容                                       | 用途                |
| --------------- | ---------------------------------------- | ----------------- |
| **Diagram**     | G6 单树图，支持缩放、拖拽、Labels 开关                 | 快速观察当前知识树规模与层级关系  |
| **Detail Tree** | 当前知识树的真实可折叠层级，基于 `buildFlatNodes.parentId` 和 `buildLinks` 控制可见节点；有 children 的节点显示可点击箭头，默认展开 root 与一级分支，点击行选中节点但不强制展开 | 精读和验证节点层级         |
| **Preview**     | 真实文件预览，不允许用节点 summary/text 冒充；提供 `原件 / 解析文本` 切换。`原件` 优先使用本轮上传的浏览器 `File`，历史 build 使用后端 `original_file_url` / `/api/build/{bid}/file`：Markdown 走 `markdown-it` + KaTeX 渲染、HTML/PDF 走 object URL 或后端原件 URL 内嵌预览，其它文本使用 monospace；`解析文本` 使用后端 `raw_text`，可按 Markdown/公式特征渲染。若解析文本里混有 `<table>` HTML 片段，先转成 Markdown 表格再交给 `markdown-it` 渲染，不能直接显示 HTML 字符串。若 `has_original_file=false` 或无 `original_file_url`，原件态必须明确提示需要重新选择文件或检查后端原件接口；Preview 空态是无边框纯提示，不额外画卡片框或描边按钮 | 对照原始内容与解析结构       |
| **JSON**        | 后端返回的原始 Build JSON，即 `tree.currentBuild` / `BuildRecord`；先 `JSON.stringify(value, null, 2)` 成标准 JSON 文本，再做语法高亮渲染；不能展示前端加工后的 `buildTrees`，也不能用 JS object tree 冒充 raw JSON；超长 string token 默认折叠为 Postman 风格 `...` 小胶囊，点击后展开完整字段 | 给开发者复制、调试、接 Agent |

Build 数据边界：

- `BuildScreen` 的 Diagram / Detail 读取当前 Build 单树展示数据：`buildTrees` / `buildFlatNodes` / `buildLinks`；Preview 必须有 `原件 / 解析文本` 模式，原件模式优先读取真实上传 `File`，否则读取后端 `original_file_url`，解析文本模式读取后端 `raw_text`，不能再展示“当前节点摘要”假预览。历史列表是摘要数据时，点击后必须调用 `GET /api/build/{bid}` 拉取完整 `tree/raw_text`。
- `BuildScreen` 的 JSON tab 必须读取后端返回原始对象 `currentBuild`，并使用 `JsonRenderer raw` 渲染标准 JSON 文本，保留 `{}`、`[]`、双引号、逗号和缩进；不能用前端加工后的 `buildTrees` 代替，也不能渲染成 JS 对象树；长字符串字段默认只露出前段内容和 `...`，用户点击 `...` 后展开，再次点击可折叠。
- `treeStore.flatNodes` / `treeStore.links` 保留给 Universe，用于呈现多知识库、多文档、多树汇聚后的森林。
- 如果一次构建包含多个文档，Build 仍应合成为一棵知识树：当前知识库是唯一 root，各文档只是 root 下的分支。
- 森林视角、远景方块墙、多树尺度感只属于 Universe，不进入 Build 工作台。

***

## 6. 右屏 — Query（结构化检索）

> 点击 `Query` Tab → 整体向左滑动，露出右屏。

```
                                            ┌──────────────────────────────────────────────────────────┐
                                            │  [Network] TreefyIt [[Hammer] Build] [[MessageCircle] Chat] [[Search] Query] [Local][Cloud] [Moon] [Github GitHub] [BookOpenText Docs]│
                                            ├──────────────────────────────────────────────────────────┤
                                            │                                                          │
                                            │  ┌─ Result JSON ─────────────────┐ ┌─ Query Controls ───┐ │
                                            │  │ {                              │ │ Knowledge base     │ │
                                            │  │   "path": "/api-reference/...", │ │ [ my-docs ▾ ]      │ │
                                            │  │   "title": "POST /parse",      │ │ Path               │ │
                                            │  │   "children": [...]             │ │ /api-reference/... │ │
                                            │  │ }                              │ │ Depth [Title Summary Full] │ │
                                            │  └───────────────────────────────┘ │ Format [JSON MD Text]      │
                                            │  ┌─ MCP Tool Schema ──────────────┐ │ [Search] Run Query │ │
                                            │  │ { "name": "treefyit_query" }    │ │ [KeyRound] tk_abc  │ │
                                            │  └────────────────────────────────┘ └────────────────────┘ │
                                            │                                                          │
                                            └──────────────────────────────────────────────────────────┘
```

### Query Controls

| 控件            | 说明                                 |
| ------------- | ---------------------------------- |
| **右侧栏宽度**     | 固定 `330px`，与 Build / Chat 侧栏宽度完全一致 |
| **知识库选择**     | 下拉选择已建好的知识库                        |
| **Tool 选择** | 单选：Overview / Inspect / Children，对应后端 `/api/trees/*` 三类真实接口 |
| **Path 输入**   | 点分树路径，如 `0`、`0.1`、`0.1.2`；Overview 模式隐藏 Path       |
| **Run Query** | 主按钮固定在参数区内，触发后刷新左侧结果               |

### Result + MCP

- **两栏布局**：Query 不再使用上下堆叠。左侧是结果，右侧是参数，让 Query 和 Build 在空间上更对称，避免三屏都把控制区放左边。
- **真实 API 结果**：首次进入 Query 不再展示 mock JSON；必须选择或构建真实 API build 后，点击 Run Query 才渲染 `/api/trees/*` 返回结果。
- **结构化 JSON 渲染**：Result 和 MCP Schema 不能只是无样式文本；必须使用 `JsonRenderer raw` 渲染标准 JSON 文本，保留原始 `{}` / `[]` / 双引号 / 逗号 / 缩进，并支持 key/value 分色与超长字段 `...` 折叠。
- **Result JSON**：左上主面板显示查询返回的结构化数据，可展开阅读，也便于后续加复制。
- **MCP Tool Schema**：左下固定展示标准 MCP Tool Definition JSON，使用同一 JSON 树组件，提供 Copy Schema 和 Test 操作。
- **字体一致**：label、按钮、正文、monospace JSON 全部使用全局字号/字重 token，避免局部随意硬编码。

### Query 当前能力与后续 Tool

Query 屏当前实现采用“左侧 Result JSON / MCP Schema + 右侧 Query Controls”的开发者工具台。控件直接映射后端真实 Agent Tools API，不再保留只影响 mock 的 depth / format 控件。

| 当前控件               | 输入                                          | 输出             |
| ------------------ | ------------------------------------------- | -------------- |
| **Knowledge base** | 选择当前已构建知识库                                  | 决定 Query 所读的树  |
| **Tool** | `overview / inspect / children` | 决定调用树概览、节点详情或子节点接口 |
| **Path** | 点分路径，如 `0`、`0.1`、`0.1.2` | Inspect / Children 模式定位目标节点 |

- `overview` 调用 `GET /api/trees/{tree_id}`，不需要 path，Path 输入自动隐藏。
- `inspect` 调用 `GET /api/trees/{tree_id}/nodes/{path}`，默认 path 为 `0`。
- `children` 调用 `GET /api/trees/{tree_id}/children/{path}`，默认 path 为 `0`。
- Query History 可以作为当前 Query 屏内的历史卡片/下拉记录，不引入外部侧栏布局。
- Result 中应优先提供机器可读 JSON，并保留扩展人类可读摘要卡片的空间。

***

## 7. 三屏切换的交互细节

### 滑动动效

```css
.viewport {
  display: flex;
  width: 300vw;          /* 三屏宽度 */
  height: 100vh;
  transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.viewport[data-active="build"]  { transform: translateX(0); }
.viewport[data-active="chat"]   { transform: translateX(-100vw); }
.viewport[data-active="query"]  { transform: translateX(-200vw); }

.screen {
  opacity: 0.68;
  transform: scale(0.985);
  transition:
    opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.screen.active {
  opacity: 1;
  transform: scale(1);
}
```

切屏体验规则：

- **必须滑动过渡**：Build / Chat / Query 永远通过横向位移进入视野，不允许直接替换组件造成“时空转移”。
- **当前屏强调**：当前屏 `opacity: 1`、`scale(1)`；非当前屏轻微降透明和缩小，滑入时自然恢复。
- **统一时长**：横向移动 `520ms`，透明度 `420ms`，曲线使用 `cubic-bezier(0.22, 1, 0.36, 1)`。
- **数据不重建**：三屏组件常驻在 `300vw` 容器内，只改变 transform，不通过 `v-if` 重挂载页面。

### 切换触发方式

| 方式            | 说明                                      |
| ------------- | --------------------------------------- |
| **点击 Tab**    | 主要方式，带 active 绿色胶囊滑动、果冻回弹和按钮 `duang` 反馈 |
| **键盘 ←→**     | 左右方向键切换相邻屏                              |
| **触控板横滑**     | 两个手指左右滑动                                |
| **边缘滑动（移动端）** | 从屏幕左/右边缘向内滑动                            |

### 数据共享

三个屏共享同一份知识库，切换时数据不丢失：

```
        ┌─────────────┐
        │  知识库数据   │
        │  (树 + 索引)  │
        └──┬────┬────┬─┘
           │    │    │
        Build Chat Query
        编辑   对话  检索
```

- **Build** 中上传/编辑 → Chat 和 Query 立即同步
- **Query** 检索结果 → 可跳转到 Chat 继续追问

***

## 8. 视觉风格

### 配色方案

```
主色:   #18181B  (经典黑)
反色:   #FFFFFF  (经典白)
强调色: #16A34A  (绿色 accent)
辅助色: #15803D  (深绿色辅助)
浅强调: #F1F8F3  (极浅绿色状态底)
背景色: #F7F7F5  (中性浅底)
边框色: #E4E4E7
文字色: #18181B
错误色: #E63946
成功色: #10B981
```

### 外部样式参考 — 设计 Token

外部仓库的 CSS Token 可作为样式参考，新设计吸收为 Vue/Sass 变量，但不继承其布局结构：

```css
/* 表层工具台 */
--color-primary: #16A34A;       /* accent only */
--color-secondary: #15803D;     /* secondary accent */
--color-accent: #F1F8F3;
--color-bg: #F7F7F5;
--color-border: #E4E4E7;
--color-text: #18181B;

/* 图谱高亮 */
--color-graph-primary: #16A34A;
--color-graph-secondary: #15803D;
--color-graph-mint: #34D399;

/* 语义色 */
--color-success: #10B981;
--color-warning: #F59E0B;
--color-error: #EF4444;
--color-info: #3B82F6;

/* 面板 */
--radius-md: 8px;
--radius-lg: 12px;
--shadow-sm: 0 1px 2px rgba(0,0,0,.04);
--shadow-md: 0 4px 12px rgba(0,0,0,.08);
--transition-fast: 120ms cubic-bezier(.4,0,.2,1);
--transition-normal: 180ms cubic-bezier(.4,0,.2,1);

/* 字体 */
--font-size-xs: 11px;
--font-size-sm: 12px;
--font-size-base: 13px;
--font-size-md: 14px;
--font-size-title: 22px;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
```

视觉使用规则：

- **表层统一**：Build 截图里的浅色工具台结构保留，基底采用黑白中性色；主按钮、Dropzone、Tab active 才使用绿色 accent。
- **克制强调**：不使用绿色高光渐变、强 glow 或大面积绿色背景；绿色只用于点击目标、状态、active 胶囊、用户气泡和少量图谱节点。
- **Chat / Query**：不再使用独立色系。Query 采用 Build 工具台卡片语言；Chat 中间消息区不使用大卡片背景，只保留悬浮气泡。
- **布局一致**：表层所有页面使用 `12px` 页面内边距，主面板均为 inset card；禁止一个页面贴边、另一个页面悬浮。
- **侧栏一致**：Chat 知识库栏、Build 左侧构建栏、Query 右侧参数栏全部固定 `330px`，不提供手动收缩按钮，避免跨屏视觉结构跳变。
- **圆角一致**：主面板统一 `12px`，控件统一 `8px`，小按钮/Tab 内片统一 `6px`，pill/badge 才允许 `999px`。
- **阴影一致**：主面板使用轻阴影，普通控件使用弱阴影；hover 只允许轻微 `translateY(-1~-2px)`，不可混用大浮层效果。
- **字体一致**：正文、label、按钮、JSON、badge 必须使用全局 font token；禁止组件内随意混用粗体 `700/800` 和不成体系的字号。
- **TreefyIt 品牌**：树的概念通过自绘 Logo、结构、`Network` 临时图标、文案和宇宙层表达；正式 Logo 中 `T` 是由数学/知识符号堆叠成的椰子树，`i` 上方黄色点是一只极简小雀。
- **Universe 深层**：保留黑色宇宙背景，节点颜色按 source 分配，绿色、青绿、lime 可作为节点色板，不影响表层黑白主题。
- **主题切换**：表层支持经典 white / black 两态切换；宇宙层始终是 dark，但浮层要跟随全局主题调整透明度和描边。

### 组件风格参考

| 组件                    | 风格要求                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| **Dropzone**          | 初始态不使用虚线，保持白底实线卡片；hover / dragover 时 `translateY(-2px)` + 主色边框/浅 accent 底 + 图标缩放              |
| **Button**            | 主按钮使用柔和实色，不使用大渐变；hover 只做轻微 lift 或颜色加深                                                        |
| **Segmented Control** | `Local / Cloud`、`auto / semantic / md`、`Overview / Inspect / Children` 均使用自定义分段按钮 |
| **Panel / Card**      | 表层白底卡片统一 `12px` 圆角、轻阴影、低对比边框                                                                  |
| **Toast**             | 右下角栈式出现，成功/错误分别使用语义色，`3.5s` 自动消失                                                              |
| **Loader**            | 页面启动可使用 logo + ring loader，构建按钮内使用小 spinner                                                   |

### 设计原则

| 原则              | 说明                                                          |
| --------------- | ----------------------------------------------------------- |
| **Chat 即首页**    | 零门槛进入，不看到 Landing Page，直接可用                                 |
| **渐进式复杂度**      | Chat 最简单 → Build 进阶 → Query 开发者                             |
| **Agent-First** | 所有输出格式化、可导出、可被 Agent 消费                                     |
| **结构可视化**       | Build 负责单树可视化，Universe 负责森林总览，Chat / Query 通过知识库绑定和路径结果访问结构 |
| **一屏原则**        | 每个模式屏 = `100vh`，内容区内部滚动                                     |

***

## 9. 用户旅程

### 典型流程

```
打开 treefyit
    ↓
看到 Chat 界面（空状态引导）
    ↓
在 Build 中上传 PDF / 粘贴 URL 并构建知识库
    ↓
系统自动解析 → 左侧出现文件 + 知识树
    ↓
Chat 使用当前 build id 调用 POST /api/chat，流式回答当前知识库问题
    ↓
(可选) 切到 Build → 查看/编辑完整树结构 → 导出 JSON
    ↓
(可选) 切到 Query → 结构化检索 → 复制 MCP Schema
```

### 状态流转

```
[空状态] → [上传文件] → [解析中 [LoaderCircle]] → [解析完成 [CheckCircle2]]
                                  ↘ [解析失败 [CircleX]] → [重试]
```

### 能力参考 — 完整端到端流程

外部仓库可作为功能完整性的验收参考，但页面布局仍按我们的三屏 + 宇宙模型执行：

```
打开首页
  ↓
看到 Chat 空状态引导、知识库切换器与纯文本输入框
  ↓
切到 Build，拖入 .md/.pdf/.html/.zip
  ↓
选择解析模式 auto / semantic / md
  ↓
选择模型 deepseek/deepseek-chat，摘要开关默认开启
  ↓
点击 Build Tree
  ↓
按钮进入 Processing，完成后写入 History
  ↓
展示横向 info tipbar：nodes / tok in / tok out，每项是小 pill，不显示 model / elapsed 字段，不允许竖向堆叠
  ↓
在 Build 屏查看结构、精读节点、对照预览、导出 JSON
  ↓
回到 Chat 屏自动绑定当前 build，用户可直接提问
  ↓
Query 选择 overview / inspect / children，输入点分 path，验证 Agent Tool 输出
  ↓
需要沉浸探索时，按 ↓ 进入知识树宇宙
```

***

## 10. 技术输出格式

### 树结构 JSON

```json
{
  "id": "root",
  "title": "Document Library",
  "children": [
    {
      "id": "sec-1",
      "title": "Introduction",
      "depth": 1,
      "content": "TreefyIt is a tool that...",
      "metadata": {
        "source": "intro.md",
        "line": 1,
        "tokenCount": 128
      },
      "children": [
        {
          "id": "sec-1-1",
          "title": "What is TreefyIt",
          "depth": 2,
          "content": "...",
          "children": []
        }
      ]
    }
  ],
  "metadata": {
    "totalNodes": 42,
    "totalTokens": 3200,
    "sources": ["intro.md", "api.pdf"],
    "createdAt": "2026-06-12T10:30:00Z"
  }
}
```

### MCP Tool Definition

```json
{
  "name": "treefyit_query",
  "description": "Query a structured knowledge tree built from documents. Returns content at the specified path with configurable depth.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Tree path, e.g. /api-reference/endpoints"
      },
      "depth": {
        "type": "integer",
        "enum": [1, 2, 3],
        "description": "1=titles, 2=titles+summaries, 3=full content"
      },
      "format": {
        "type": "string",
        "enum": ["json", "markdown", "text"],
        "default": "json"
      }
    },
    "required": ["path"]
  }
}
```

### API 运行模式与请求层

当前 Demo 已切换为真实 API 数据源，不再加载内置假数据。前端请求层按后端文档 `/Users/bytedance/docs/treefyit-demo/apidoc.md` 维护 endpoint，Build / History / Query 直接请求真实后端。

| 模式        | TreefyIt API 地址                               | LLM Provider 配置                  | 配置规则                                                   |
| --------- | ---------------------------------- | ------------------- | ------------------------------------------------------ |
| **Local** | 默认走同源 `/api` 代理到 `http://localhost:8765` | 用户填写自己的 `LLM Provider Base URL` 和 `LLM Provider API Key` | TreefyIt 后端地址不暴露在 Local 表单里；前端通过 Vite dev server proxy 避免浏览器 CORS；Provider 地址只表示模型供应商地址，例如 OpenAI/OpenRouter 兼容 base URL |
| **Cloud** | `https://api.treefyit.example.com` | 使用 TreefyIt 托管端能力，不要求用户填写 Provider URL / API Key | 通过顶部齿轮打开 API Settings；选择 Cloud 后只显示托管服务说明 |

实现约束：

- 请求层统一从 `apiConfigStore.baseUrl` 读取 TreefyIt 后端地址，不在组件内硬编码 host；Local 默认 `baseUrl = ''`，因此请求同源 `/api/*`。
- `Local / Cloud` 只是运行环境选择，不改变页面布局和真实 API 数据结构。
- `apiConfigStore` 保存 `mode`、`cloudBaseUrl`、`localLlmBaseUrl`、`localApiKey`；`baseUrl` 只代表 TreefyIt API 地址，`localLlmBaseUrl` 只代表用户自己的 LLM Provider 地址，不能混用。
- 顶部 `TopNav` 只展示齿轮设置入口和 API Settings 模态框，不直接发请求。
- API Settings 表单保存时，Local 模式更新 `localLlmBaseUrl` 和 `localApiKey`；Local 表单不再填写 `http://localhost:8765`，TreefyIt 后端联调地址由 Vite `/api` 代理和 `vite.config.ts` 管理。
- Build 提交 `POST /api/build` 时，如处于 Local 模式，可随 `multipart/form-data` 附带 `llm_base_url` 和 `llm_api_key`，供后端转发给用户自己的模型供应商；不再把该 Key 当作 TreefyIt 后端鉴权 header。
- Build、Chat、Query 都通过 `services/apiClient.ts` 的 endpoint 常量组装 URL。
- `services/apiClient.ts` 提供真实后端 endpoint 常量和 `resolveApiUrl(config, endpoint, params)`；Build / Chat / Query store 使用它组装请求 URL。
- Chat 使用真实流式接口 `POST /api/chat`，请求体为 `{ bid, question, model, session_id? }`；首次请求不带 `session_id`，从 `start.session_id` 保存会话，后续同一 build 的追问自动带回 `session_id`。响应为 `text/event-stream`，前端需兼容纯 NDJSON 行和标准 `data: {...}` SSE 行。
- Chat 事件处理：`text` 事件按顺序追加到当前文本片段；`tool_call` 必须把当前回答分割成 `text / tool / text` 结构，工具调用渲染在气泡外面，作为两个文本气泡之间的过程分隔块，显示“Agent 正在使用检索工具”、工具名和参数摘要；`tool_result` 必须更新同一条工具事件为完成/失败，并显示结果摘要；`done.answer` 仅在尚无文本时兜底填充；`error` 转为系统提示。
- Chat 工具可见性：工具调用不是 debug 信息，必须明确展示给用户，让用户知道 Agent 正在检索知识树；运行中使用 spinner，完成使用 success 状态，失败使用 error 状态。
- Chat 气泡分割：工具调用不允许嵌在 AI 气泡内部；如果回答流为 `文本 A -> tool_call -> tool_result -> 文本 B`，UI 必须渲染为 `AI 气泡 A`、`工具调用分隔块`、`AI 气泡 B`。
- Chat 工具块布局：工具调用分隔块必须与前后 AI 气泡左侧完全对齐、宽度一致；不允许额外左侧竖线、缩进或装饰物破坏对齐。工具块默认折叠，只显示状态、工具名和一行紧凑信息；展开后才显示参数和结果详情。
- Chat 主消息区和侧栏聊天记录必须自动跟随最新内容滚动；不仅新增消息要滚到底，流式 token、工具结果更新、Replay / History 生成中追加内容也要触发滚动，避免用户手动翻到底。
- 当前后端文档没有独立 `POST /api/query`，Query 屏应映射到 `/api/trees/*` 的 overview / inspect / children 能力。
- Cloud 地址、鉴权 header、超时、错误码、流式输出等细节等后端文档确认后补齐。

### 当前实现文件映射

| 能力                | 文件                                                                                                                    | 当前状态                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **三屏横滑**          | `src/components/surface/SurfaceViewport.vue`                                                                          | `300vw` 容器常驻，`translateX(0 / -100 / -200vw)` 切换，active 屏做 opacity/scale 过渡      |
| **导航 / API / 主题** | `src/components/nav/TopNav.vue`                                                                                       | Build/Chat/Query 胶囊 Tab、API Settings 齿轮按钮和模态表单、主题 icon button、GitHub/Docs 图标链接 |
| **全局 UI 状态**      | `src/stores/uiStore.ts`                                                                                               | `activeScreen`、`themeMode`、`isUniverseMode`、`isChatKnowledgeDocked`、宇宙过渡状态、`isUniverseLabelsVisible`      |
| **API 配置**        | `src/stores/apiConfigStore.ts`                                                                                        | `local/cloud` 模式、TreefyIt API base URL、用户自带 `localLlmBaseUrl`、Local Provider API Key                                  |
| **API URL 解析**    | `src/services/apiClient.ts`                                                                                           | 按 `apidoc.md` 维护 endpoint 常量和路径参数替换，供 Build / Query store 真实请求使用                                                        |
| **Build 单树**      | `src/components/surface/BuildScreen.vue` / `src/stores/treeStore.ts`                                                  | Build 只读 `buildTrees`、`buildFlatNodes`、`buildLinks`，Diagram 使用动态 `@antv/g6`     |
| **Chat 输入与吸附**    | `src/components/surface/ChatScreen.vue` / `src/components/chat/ChatInput.vue` / `src/components/chat/ChatSidebar.vue` / `src/stores/chatStore.ts` | 知识库面板输入态吸附到输入框左侧，输入框右侧有 `SendHorizontal` 发送按钮；`chatStore` 调用 `POST /api/chat`，维护 `session_id` 并解析 NDJSON / SSE stream |
| **Query 结果**      | `src/components/surface/QueryScreen.vue`                                                                              | 左侧 Result JSON + MCP Schema，右侧 Query Controls                                   |
| **JSON 渲染**       | `src/components/common/JsonRenderer.vue`                                                                              | Build JSON、Query Result、MCP Schema 统一使用结构化树渲染                                   |
| **Universe 前景图** | `src/components/universe/ForceGraph.vue` / `src/composables/useForceGraph.ts` / `src/components/universe/UniverseStatusBar.vue` | D3 力导森林视角，节点视觉对齐 Build Diagram，底部状态栏提供 Labels 开关 |

### API Endpoint 清单（按 `apidoc.md`）

| 场景 | 方法与路径 | 入参 | 返回/用途 |
|------|------------|------|-----------|
| **构建知识树** | `POST /api/build` | `multipart/form-data`: `file`, `model?`, `mode?`, `summarize?` | 完整 build 对象：`id`, `filename`, `raw_text`, `mermaid`, `tree`, `stats`, `created_at`, `cached`, `error?` |
| **流式构建知识树** | `POST /api/build/stream` | 同 `/api/build` | `application/x-ndjson`；逐行返回 `start/progress/warning/done/error`，`done.result` 与 `/api/build` 完整对象一致 |
| **构建历史** | `GET /api/history` | 无 | 按时间倒序返回完整 build 对象列表 |
| **构建详情** | `GET /api/build/{bid}` | `bid` | 单次 build 的完整结果；未找到返回 `404 { error: "not found" }` |
| **删除构建** | `DELETE /api/build/{bid}` | `bid` | `{ ok: true }`，同时清理内存、SQLite、磁盘缓存和工具注册 |
| **树列表** | `GET /api/trees` | 无 | `[{ tree_id, node_count, max_depth }]` |
| **树概览** | `GET /api/trees/{tree_id}` | `tree_id` | `{ tree_id, node_count, max_depth, roots }` |
| **节点详情** | `GET /api/trees/{tree_id}/nodes/{path}` | `tree_id`, 点分路径如 `0.1.2` | 节点 `title / text / summary / children_count / children` |
| **子节点** | `GET /api/trees/{tree_id}/children/{path}` | `tree_id`, 点分路径 | 指定节点 children 列表 |
| **查询日志** | `GET /api/queries` | 无 | 最近 200 条工具调用记录 |
| **查询统计** | `GET /api/queries/stats` | 无 | 总数、按 tool/tree 聚合、最近 20 条 |
| **Chat 流式问答** | `POST /api/chat` | JSON: `bid`, `question`, `model?`, `session_id?` | `text/event-stream`，事件含 `start/text/tool_call/tool_result/done/error` |
| **Chat sessions** | `GET /api/sessions` | `bid?`, `limit?` | `{ sessions }`，列出聊天会话 |
| **Chat turns** | `GET /api/sessions/{sid}/turns` | `sid`, `limit?` | `{ session_id, turns }`，读取会话轮次 |
| **删除 Chat session** | `DELETE /api/sessions/{sid}` | `sid` | `{ deleted, session_id }` |

### Build Stats 格式

```json
{
  "node_count": 42,
  "input_tokens": 12800,
  "output_tokens": 3200,
  "elapsed_sec": 3.8,
  "model": "deepseek/deepseek-chat",
  "mode": "auto"
}
```

### Query Tool Definition（后续能力增强版）

```json
{
  "name": "treefyit_query",
  "description": "Query a document knowledge tree by overview, node inspection, or children lookup.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tree_id": {
        "type": "string",
        "description": "Build/tree id from history"
      },
      "tool": {
        "type": "string",
        "enum": ["overview", "inspect", "get_children"],
        "default": "overview"
      },
      "path": {
        "type": "string",
        "description": "Dot path such as 0, 0.1, 0.1.2. Required for inspect/get_children."
      },
      "format": {
        "type": "string",
        "enum": ["json", "markdown", "text"],
        "default": "json"
      }
    },
    "required": ["tree_id", "tool"]
  }
}
```

***

## 11. 响应式策略

| 断点                    | 布局变化                         |
| --------------------- | ---------------------------- |
| `≥ 1024px` (Desktop)  | 三屏横滑，每屏内部双栏（侧栏 + 主区）         |
| `768–1023px` (Tablet) | 三屏横滑保留，页面内面板可折叠或临时覆盖         |
| `< 768px` (Mobile)    | 底部 Tab Bar 替代顶部 Tab，侧栏全屏覆盖弹出 |

外部样式参考仅用于响应式细节：

- 所有 touch 设备按钮、输入框、选择框最小触控尺寸为 `44px × 44px`。
- 移动端保留我们的底部 Tab Bar，不采用外部仓库的页面布局。
- 卡片间距、按钮尺寸、输入框高度可参考外部仓库的移动端密度。

***

## 12. 后续迭代方向

| 阶段   | 功能                        |
| ---- | ------------------------- |
| v0.2 | 支持更多格式：DOCX、PPTX、EPUB     |
| v0.3 | 协作：多人共建知识树                |
| v0.4 | 增量更新：文档变更后只更新差异部分         |
| v0.5 | 自定义解析规则：用户定义标题识别规则 / 分段策略 |
| v0.6 | 托管服务：一键部署知识库 API          |
