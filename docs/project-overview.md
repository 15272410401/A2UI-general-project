# A2UI 项目全流程说明

本文按实现顺序梳理仓库：从 monorepo 架构、SDK、mock 调试、Playground 渲染、组件协议、服务端、Agent、Prompt，到真实对话流式解析、多轮微调、多模态，以及如何新增自定义组件。

组件字段细节以 [`docs/a2ui-vue-renderer-catalog.md`](./a2ui-vue-renderer-catalog.md) 为准；官方协议对照见 [`specification/v0_9/json/basic_catalog.json`](../specification/v0_9/json/basic_catalog.json)。本文讲的是**代码怎么串起来**。

---

## 1. 项目架构

pnpm workspace（[`pnpm-workspace.yaml`](../pnpm-workspace.yaml)）：

| 包 | 路径 | 职责 |
|----|------|------|
| `@a2ui/core` | `packages/a2ui-core` | 协议解析、Zustand store、组件树、DataModel、流式 JSON→JSONL |
| `@a2ui/vue` | `packages/a2ui-vue` | 18 个 Vue 组件 + `renderMap` + 公共 `style` |
| `a2ui-playground` | `web/a2ui-playground` | 左侧预览 + 右侧对话；把树渲染成 Vue VNode |
| `a2ui-playground-server` | `server/a2ui-playground-server` | Koa + AG-UI SSE；调多模态模型生成 A2UI JSON |

根脚本（[`package.json`](../package.json)）：

- `pnpm run dev:web`：Vite 前端（默认 5173），`/agent`、`/chat`、`/health` 代理到 `localhost:3001`
- `pnpm run dev:server`：`ts-node` 启动服务，默认端口 `3001`

数据流：

```text
用户文字 / 图片
    → Playground POST /agent（历史 + currentA2uiJson）
    → Server system prompt + catalog
    → LLM 流式输出 {"messages":[...]}
    → 服务端 extractA2uiEnvelopes（组件级信封）
    → SSE ACTIVITY_SNAPSHOT
    → 客户端 StreamBuffer / parseMessage
    → store（surface / hydrate / tree / dataModel）
    → createVNodeFromTree + renderMap
    → 左侧预览
```

---

## 2. SDK：`@a2ui/core`

入口 [`packages/a2ui-core/src/index.ts`](../packages/a2ui-core/src/index.ts) 导出 store、parser、treebuilder、streaming、datamodel、binding。

### 2.1 Store

[`src/store/store.ts`](../packages/a2ui-core/src/store/store.ts) 用 Zustand 做**进程内单例**。

必须先 `init(renderMap)`，否则 `getStore()` 抛错。Playground 在 `onMounted` 里调用 `init(renderMap)`，把 Vue 组件表写进 store。

四张表：

| 字段 | 含义 |
|------|------|
| `surfaceMap` | 一次 `createSurface` 对应一块画布（`surfaceId`、root、`sendDataModel`） |
| `hydrateNodeMap` | 扁平组件表。key 是组件 `id`，value 含 `_vnode`（tag、原始 props、子 id 列表、Vue 组件引用） |
| `componentTreeMap` | 按 surface 建好的父子树，供渲染遍历 |
| `dataModelMap` | 每个 surface 一份 JSON 文档 |

`deleteSurface` 会同时清掉该 surface 的 dataModel 与组件树。

### 2.2 信封解析 `parseMessage`

[`src/parser/index.ts`](../packages/a2ui-core/src/parser/index.ts) 只认四种信封（都带 `version: "v0.9"`）：

1. **`createSurface`**：登记 surface，dataModel 置为 `{}`。
2. **`updateComponents`**：逐个组件写入 hydrate，再 `buildComponentTree`。
3. **`updateDataModel`**：有 `value` 则按 JSON Pointer upsert；没有 `value` 则删除 path。**不重建树**，渲染时再读 dataModel。
4. **`deleteSurface`**：删该 surface 下全部 hydrate 节点和 surface 本身。

`updateComponents` 里每个对象拆成 `id`、`component`（类型名）和其余字段。类型名去 `renderMap` 查 Vue 组件；查不到记渲染错误「以下组件未注册渲染器」，节点仍会进树，预览里显示 `Component not found`。

子节点归一（`normalizeComponentChildren`）：

- `children: string[]` → 子 id 列表（Column / Row / List）
- `child: string` → 单子节点（Card）
- Modal 的 `trigger` + `content` → slot 顺序 `[trigger, content]`
- Tabs 的 `tabs[].child` → 面板子节点；`tabs` 本身仍留在 props 里（标题）

`id === "root"` 的节点写回 surface.rootNode。同一 id 再次 update 会覆盖 props，但保留 `hasMounted`（避免微调时重播进场动画）。

### 2.3 组件树

[`src/treebuilder/index.ts`](../packages/a2ui-core/src/treebuilder/index.ts)：

1. 筛出属于该 surface 的 hydrate 节点。
2. 收集所有被当成 child 的 id；**没出现在任何 children 里的就是根**（正常情况下只有 `root`）。
3. 按 children id 递归挂子树。
4. props **保持协议原值**（字面量或 `{path}`），同时抽出 `propBindings`。

数据变了不重建树，避免把绑定快照写死。

### 2.4 DataModel 与绑定

[`src/datamodel/pointer.ts`](../packages/a2ui-core/src/datamodel/pointer.ts) 实现 RFC 6901：

- `""` 或 `"/"` 表示整份文档
- `setByPointer` 返回新对象，中间路径自动补对象/数组

[`src/binding/index.ts`](../packages/a2ui-core/src/binding/index.ts)：

- 只有 `{ path: string }` 且没有别的键，才算 DataBinding
- `resolveProps` 渲染时用当前 dataModel 把绑定换成字面量
- FunctionCall 在绑定层不解析，留给按钮 Action

### 2.5 客户端 Action

[`src/parser/action.ts`](../packages/a2ui-core/src/parser/action.ts) 的 `handleClientAction`：

- `functionCall.call === "updateDataModel"`：本地写 dataModel
- `functionCall.call === "openUrl"`：新标签打开 URL
- `{ event }`：返回 `'server'`（当前 MVP 不回传服务端）

### 2.6 流式缓冲 `StreamBuffer`

[`src/parser/streaming.ts`](../packages/a2ui-core/src/parser/streaming.ts)。

模型输出的是一整份 `{"messages":[...]}`，不是 JSONL。`StreamBuffer` 在 JSON 还没闭合时，把**已经完整的最小单元**抽成一行 JSON：

- 完整信封原样成行
- `updateComponents` **按单个 component 拆行**（每个组件一条 `updateComponents`，`components` 长度为 1）
- 数组还没闭合时，扫描已闭合的 `components[]` 元素，提前合成信封（`extractPartialUpdateComponentsJsonl`）
- 跳过空白和 markdown 围栏

`parseMessageChunk(buffer, chunk)` = `append` + `extract` + 每行 `parseMessage`。Playground 预览走服务端已经拆好的信封；对话框里的「本轮流式 JSONL」则用同一个 `StreamBuffer` 把原始 JSON 再转一遍，方便对照。

---

## 3. SDK：Vue 渲染引擎 `@a2ui/vue`

[`packages/a2ui-vue/src/index.ts`](../packages/a2ui-vue/src/index.ts) **不负责建树**，只注册组件：

```ts
export const renderMap = { Text, Image, Icon, /* ... */ Divider }
```

组件名必须和协议字段 `component` 完全一致。

### 3.1 单个组件怎么画

每个 `.vue` 的模式相同：

1. `defineProps` 对应 catalog 字段（枚举 class + 业务 props）。
2. 可选 `style?: A2uiStyle`。
3. 根节点 `:class="..."` + `:style="normalizeStyle(props.style)"`。
4. 有子节点的用默认 `<slot>`；Modal / Tabs 按 slot 下标取 trigger/content 或面板。

[`utils/style.ts`](../packages/a2ui-vue/src/utils/style.ts)：

- 对象：`{ color, fontSize, marginTop }` 直接给 Vue
- 字符串：`"color:#ef4444;margin-top:12px"` 按分号拆，kebab 转 camel
- `mergeStyles` 后者覆盖前者（组件内计算样式与协议 style 并存时，协议 style 优先）

按钮额外 `emit('action', props.action)`。Playground 在创建 VNode 时挂 `onAction`，接到 `handleClientAction`。

表单（TextField、CheckBox、Slider 等）对绑定字段发 `update:value`。Playground 把 `propBindings` 转成 `onUpdate:value`，调用 `writeDataModelValue` 后重绘。

### 3.2 布局注意点

- **Row**：`display:flex; flex-direction:row; flex-wrap:nowrap; width:100%`。不换行，避免子项被挤成纵向。
- **Column**：纵向 flex，**不设 `width:100%`**。放在 Row 里时按内容宽度横排；放在 Column 里时由父级 `align-items: stretch` 拉满。
- 需要均分时在子组件写 `"style": { "flex": "1" }`。

Card、List、Tabs、Divider、Slider 等块级组件自身仍是 `width:100%`，单独作为 Row 子项时会占满一行，这是刻意的块级行为。

---

## 4. Mock JSON 调试

样例在 [`packages/a2ui-core/mock/`](../packages/a2ui-core/mock/)：

| 文件 | 覆盖 |
|------|------|
| `column-layout.json` | Column / Row 嵌套、Icon、Button |
| `text-component.json` | Text |
| `login-form.json` | 表单 + DataModel |
| `shopping-cart.json` | 列表与绑定 |
| `local-action.json` | `updateDataModel` / `openUrl` |
| `full-catalog.json` | 尽量覆盖现有组件 |

根结构与 Agent 输出一致：

```json
{
  "messages": [
    { "version": "v0.9", "createSurface": { "surfaceId": "...", "catalogId": "..." } },
    { "version": "v0.9", "updateDataModel": { "surfaceId": "...", "value": {} } },
    { "version": "v0.9", "updateComponents": { "surfaceId": "...", "components": [] } }
  ]
}
```

调试方式：

- `pnpm --filter @a2ui/core test`（mocha）：parser / store / treebuilder / datamodel / streaming。测试里用精简 `renderMap`（例如只注册 Text），不启动 Vue。
- 人工：把 mock 的 `messages` 逐条喂给 `parseMessage`，再看 store 的 tree 与 dataModel。Playground 运行时不内置「加载 mock 文件」按钮，mock 主要给单测和 prompt 示例对齐。

---

## 5. Playground 渲染

[`web/a2ui-playground/src/App.vue`](../web/a2ui-playground/src/App.vue) 左预览、右 [`ChatPanel.vue`](../web/a2ui-playground/src/components/ChatPanel.vue)。预览区是一个空 `div`（`previewRef`），**不用模板递归组件**，而是 `vue` 的 `createVNode` + `render()` 手动挂载。这样和 core 的树一一对应，也方便在节点上挂 `data-a2ui-id`。

### 5.1 从树到 DOM

`renderPreview`：

1. 取 `componentTreeMap` 的第一个 surface。
2. 对每个根节点调用 `createVNodeFromTree`。
3. `render(container, previewRef)`。
4. `markNodesMounted`：首次绘制后把 hydrate 的 `hasMounted` 设为 true。

`createVNodeFromTree`：

1. `resolveProps(node.props, dataModel)` 得到当前字面量 props。
2. 加上 `key`、`data-a2ui-id`。未挂载过的节点加 class `a2ui-fade-in`。
3. `attachBindingHandlers`：有 path 的字段监听 `onUpdate:<prop>`，写回 dataModel 并重绘。
4. `attachActionHandler`：有 `action` 则监听 `onAction`。
5. `createVNode(component, props, childrenVnodes)`。`component` 来自建树时写入的 Vue 组件；没有则渲染一段 “Component not found”。

预览区 `click` 捕获阶段：按住 Ctrl/Cmd 点到带 `data-a2ui-id` 的节点，把 id 插进对话框芯片，不改变布局。发送时拼进用户句子（`id="xxx"`），方便模型做定点微调。

调试弹窗：

- **Store**：DataModel / Surfaces / HydrateNodes / ComponentTrees / Error
- **Agent JSON**：本轮原文、StreamBuffer 转出的 JSONL、合并后的完整文档
- **Error**：parser / renderer 错误

---

## 6. Renderer 组件协议

生成给模型看的协议不是官方 catalog 全文，而是 [`docs/a2ui-vue-renderer-catalog.md`](./a2ui-vue-renderer-catalog.md)。

原因：Vue 实现和 basic_catalog 有偏差，例如 Button 用 `text` 不用 `child`，Image 用 `src`/`alt`，Icon 用 `icon`。Prompt 明确「不要发明文档里没有的组件或字段」。

公共约定：

- 组件对象：`id` + `component` + 特有字段
- 子节点只写字符串 id，禁止内联对象
- 动态值只用 `{"path":"/a/b"}`
- 所有组件可选 `style`（对象或声明字符串）

服务端 `getA2uiSystemPrompt()` 启动时把这份 markdown **整篇读进 system prompt**（有内存缓存；改 catalog 后需重启 server）。

---

## 7. Server

[`server/a2ui-playground-server/src/index.ts`](../server/a2ui-playground-server/src/index.ts)：

| 路由 | 作用 |
|------|------|
| `GET /health` | 是否配了 LLM key、当前模型名 |
| `POST /chat` | 纯文本对话 SSE，不产 A2UI（Playground「仅模型对话」开关） |
| `POST /agent` | AG-UI：`RunAgentInput` → SSE 事件流 |

配置 [`src/config.ts`](../server/a2ui-playground-server/src/config.ts)：先 `.env` 再 `.env.example`。密钥 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`，`baseURL` / `model` 同理。客户端是 OpenAI SDK（[`src/llm/client.ts`](../server/a2ui-playground-server/src/llm/client.ts)）。

body 上限 12mb，给 base64 图片留空间。

---

## 8. Agent 联调

[`src/routes/agent.ts`](../server/a2ui-playground-server/src/routes/agent.ts) 把 HTTP 收成 SSE（`Content-Type: text/event-stream`，`ctx.respond = false` 后直接 `res.write`）。

请求体（Playground 发送）：

- `threadId` / `runId`
- `messages`：历史 user/assistant 文本
- `images`：最多 4 张 data URL 或 http(s)
- `currentA2uiJson`：上一轮合并后的完整 `{"messages":[...]}`，有它就算微调

事件顺序：

1. `RUN_STARTED`
2. `STEP_STARTED`（`a2ui_generate`）
3. `TEXT_MESSAGE_START`
4. 流式循环：`TEXT_MESSAGE_CONTENT`（模型原文增量）和 `ACTIVITY_SNAPSHOT`
5. `TEXT_MESSAGE_END` → `STEP_FINISHED` → `RUN_FINISHED`
6. 失败：`RUN_ERROR`

`ACTIVITY_SNAPSHOT`：

- `activityType`: `a2ui-surface`
- `content.a2ui_operations`: 当前已解析出的信封数组（组件级）
- `replace`: **没有** `currentA2uiJson` 时为 `true`（整表替换）；有则为 `false`（增量）

[`src/agent/a2ui-agent.ts`](../server/a2ui-playground-server/src/agent/a2ui-agent.ts) 的 `streamA2uiGeneration`：

1. `chat.completions.create({ stream: true, temperature: 0.2 })`
2. 每个 token 先 `yield { type: 'text' }`（对话区看到的就是模型原文，不是占位句）
3. 累计 buffer 调 `extractA2uiEnvelopes`；信封指纹变了才 `yield { type: 'operations' }`

[`parse-jsonl.ts`](../server/a2ui-playground-server/src/agent/parse-jsonl.ts) 与 core 的 `StreamBuffer` 同一思路：跳过围栏、括号扫描、在 `messages` 数组未闭合时抽出已完整信封，并把 `updateComponents` 拆到单个组件。这样左侧可以在整份 JSON 结束前逐个组件出现。

联调检查：`GET /health` 里 `llm: true`；对话区应出现模型正在写的 JSON 文本；左侧随 `ACTIVITY_SNAPSHOT` 增长；「查看 Agent JSON」能看到原文、JSONL、合并文档三份。

---

## 9. Agent Prompt

[`src/prompts/a2ui-system.ts`](../server/a2ui-playground-server/src/prompts/a2ui-system.ts) 固定约束：

- 只输出一个 JSON 对象 `{"messages":[...]}`，不要 Markdown、不要解释、不要 JSONL
- 首轮 `messages[0]` 必须是 `createSurface`，`surfaceId` 固定 `"main"`
- 有动态文案时：`updateDataModel` 放在 `updateComponents` **前面**
- `updateComponents` 先写 `surfaceId` 再写 `components`，**第一个组件必须是 `root`**（Column 或 Row），方便流式先出骨架
- 子节点只能是 id 字符串
- 允许并鼓励用 `style` 改外观
- 多轮时**不要**再发 `createSurface`，**不要**重发未改组件；只发变更信封

模板字符串里如果要写反引号（例如 `` `style` ``），必须写成 `` \`style\` ``，否则 `ts-node` 会把后面整段当成代码，服务起不来。

`buildLlmMessages` 在有 `currentA2uiJson` 时，把完整文档作为一条 assistant 消息插到本轮 user 之前，并改写 user 文本：「只输出增量 messages，不要 createSurface，不要未改动组件」。图片只挂在**最后一条 user** 的 `image_url` parts 上。

---

## 10. 真实对话：JSON 解析并渲染

一次首轮生成（客户端 [`sendChatMessage`](../web/a2ui-playground/src/App.vue)）：

1. 组 body：`messages`（不含本轮正在生成的助手占位）、`images`、`currentA2uiJson`（首轮为空）。
2. `fetch('/agent')`，按 SSE 块（`\n\n`）读 `data: {...}`。
3. `TEXT_MESSAGE_CONTENT`：把 `delta` 追加到助手气泡，同时累加 `agentRawJson`。
4. `ACTIVITY_SNAPSHOT`：取出 `content.a2ui_operations`，交给 `applyA2uiOperations(ops, event.replace)`。
5. 首轮 `replace !== false` 且操作列表含 `createSurface`：清空 store，按顺序 `parseMessage` 每一条信封。
6. `updateStoreState` + `renderPreview`。
7. `rebuildDocumentJson` 把「按组件拆开的信封」合并回一份给人/模型读的 `{"messages":[ createSurface, dataModel..., 一条合并后的 updateComponents ]}`，`root` 排在 components 最前。这份字符串存进 `agentDocumentJson`，作为下一轮的真源。

因此同一轮里预览会多次重绘：服务端每多解析出一个组件就推一次 snapshot，客户端整表重放当前已有信封（首轮），画面随组件变完整。

---

## 11. 多轮微调

第二轮及以后：

1. 发送前把 `agentDocumentJson` 放进 `currentA2uiJson`，**不清空预览**。
2. 服务端 `replace: false`。
3. 客户端 `applyA2uiOperations`：若本轮操作**不含** `createSurface` 且已有上一轮操作，则只 `parseMessage` **尚未应用过的后缀**（`operations.slice(appliedOpsThisTurn)`）。同一轮里 snapshot 会越来越长，已应用前缀不再重复 parse。
4. `mergeOperations` 按组件 id 覆盖旧信封，按 dataModel path 覆盖旧数据；新 id 追加。
5. 再次 `rebuildDocumentJson`，下一轮看到的是合并后的全量，而不是增量碎片。

效果：改一个按钮颜色时，模型应只回该 Button（以及必要时的父节点）的 `updateComponents`，store 里其它 hydrate 保持不动，预览不整页闪成空白。

Ctrl/Cmd+点击插入的 id 只是提示词，不改协议。模型仍按 catalog 输出 `style` 或字段补丁。

重置（「重置」按钮）会换新 `threadId`、清空对话和 store。

---

## 12. 多模态

[`ChatPanel.vue`](../web/a2ui-playground/src/components/ChatPanel.vue)：本地选图，`FileReader` 读成 data URL，最多 4 张。仅模型对话模式下不上传图片。

服务端 `collectImages` 接受 `body.images` 或 `forwardedProps.images`，过滤 `data:image/` 与 http(s)。

`buildUserContentWithImages` 变成 OpenAI 多模态 content：

```ts
[
  { type: 'text', text },
  { type: 'image_url', image_url: { url } },
]
```

没有文字只有图时，用户气泡显示「请根据图片生成界面」，prompt 要求按截图结构、文案、层级还原。首轮仍输出完整 `messages`；若当时已经有界面 JSON，则走增量规则。

纯文本通道 `POST /chat` 不带图片、不解析 A2UI，只把模型文字流回对话区。

---

## 13. 自定义组件

新增一种协议组件需要改三处，并让 prompt 重新加载 catalog。

### 13.1 Vue 组件

在 `packages/a2ui-vue/src/components/` 增加 `MyWidget.vue`：

- props 与准备写进 catalog 的字段一致
- 带上 `style?: A2uiStyle`，根节点 `:style="normalizeStyle(props.style)"`
- 若有子节点，用 `<slot>`；若是 Modal/Tabs 那种特殊槽位，要同时改 core 的 `normalizeComponentChildren`

### 13.2 注册 renderMap

[`packages/a2ui-vue/src/index.ts`](../packages/a2ui-vue/src/index.ts)：

```ts
import MyWidget from './components/MyWidget.vue'
// renderMap 与具名导出都加上 MyWidget
```

键名即协议里的 `"component": "MyWidget"`。未注册时 parser 会报渲染错误，树节点的 `component` 为空。

### 13.3 写进协议文档

在 [`docs/a2ui-vue-renderer-catalog.md`](./a2ui-vue-renderer-catalog.md) 增加一节：字段表、与 basic_catalog 的差异、一条 JSON 示例。文首「覆盖组件」列表也要补上名字。

Prompt 通过读这个文件生成，**不改 TypeScript 也会生效**，但 `getA2uiSystemPrompt` 有缓存，且 catalog 在进程启动时读取，改完后重启 `pnpm run dev:server`。

### 13.4 可选：单测与 mock

- 在 `packages/a2ui-core/mock/` 加一份含该组件的 `messages` JSON
- 若子节点写法不是 `children`/`child`，在 parser 测试里覆盖 `normalizeComponentChildren`
- Playground 无需改渲染循环：`createVNodeFromTree` 只看 `renderMap` 里的组件引用

本地验证：重启 server 后让 Agent「用 MyWidget 做……」，或在单测里 `parseMessage` 后检查 hydrate 的 `protocal` 与树 children。
