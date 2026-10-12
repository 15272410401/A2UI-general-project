# a2ui-vue Renderer 组件协议

本文档描述当前 [`packages/a2ui-vue`](../packages/a2ui-vue) renderer（`renderMap`）**实际支持**的 A2UI 组件协议，对照官方 [`specification/v0_9/json/basic_catalog.json`](../specification/v0_9/json/basic_catalog.json)（v0.9）。

> **说明**  
> - 字段以 **当前 Vue 组件 props** 为准；与 basic_catalog 不一致处单独标注。  
> - 公共字段：所有组件经 parser 后均有 `id`（组件 ID）。布局类通过 `children` / `child` / `tabs` / `trigger`+`content` 挂子节点（由 `@a2ui/core` 归一为树）。  
> - **公共 `style`**：任意组件可带 `style`（CSS 对象或 `kebab-case` 声明字符串），直接作用在根 DOM 上，便于多轮微调改颜色/间距等，不限于 class 枚举。  
> - 数据绑定：属性可为字面量，或 `{"path":"/json/pointer"}`（由 DataModel 解析）；表单 `value` 支持写回。

**覆盖组件（18）：** Text, Image, Icon, Video, AudioPlayer, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput, Column, Row, List, Card, Tabs, Modal, Divider

---

## 1. 公共约定

### 1.1 消息中的组件对象

```json
{
  "id": "component-id",
  "component": "Text",
  "...": "组件特有字段"
}
```

### 1.2 子节点引用

| 协议写法 | 适用组件 | Renderer / Core 处理 |
|----------|----------|----------------------|
| `children: string[]` | Column, Row, List | 默认 slot 按序渲染 |
| `child: string` | Card（及协议 Button） | 归一为单子节点 slot |
| `tabs: [{ title, child }]` | Tabs | `tabs` 留 props；`child` 归一为 slot 面板 |
| `trigger` + `content` | Modal | 归一为 slot `[0]=trigger, [1]=content` |

### 1.3 Dynamic 值（绑定）

```json
"Hello"
{ "path": "/user/name" }
```

当前 MVP：**字面量** + **绝对 path**。FunctionCall / 相对 path / 列表模板暂不支持。

### 1.4 公共 style（微调）

所有组件支持可选字段 `style`：

| 写法 | 示例 |
|------|------|
| CSS 对象 | `"style": { "color": "#ef4444", "marginTop": "12px" }` |
| 声明字符串 | `"style": "color:#ef4444;margin-top:12px"` |

说明：与 `variant` / `size` 等枚举 class 可并存；同名 CSS 属性以 `style` 为准（覆盖组件内置尺寸/颜色计算值）。

```json
{ "id": "title", "component": "Text", "text": "Hello", "variant": "h2", "style": { "color": "#ef4444" } }
```

---

## 2. 展示类

### Text

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 对齐 | 基本对齐 | — |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `text` | `string` \| `{path}` | 是 | — | 文本内容 |
| `variant` | `h1`\|`h2`\|`h3`\|`h4`\|`h5`\|`caption`\|`body` | 否 | `body` | 文本样式 |

```json
{ "id": "title", "component": "Text", "text": "Hello", "variant": "h1" }
```

---

### Image

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 偏差 | `url`, `description`, `fit`, `variant` | `src`, `alt`, `width`, `height`, `borderRadius` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `src` | `string` | 是 | — | 图片地址（对应 catalog `url`） |
| `alt` | `string` | 否 | `""` | 无障碍文本（对应 `description`） |
| `width` | `string`\|`number` | 否 | `"100%"` | 宽度 |
| `height` | `string`\|`number` | 否 | `"auto"` | 高度 |
| `borderRadius` | `string` | 否 | `"0"` | 圆角 |

```json
{ "id": "img1", "component": "Image", "src": "https://example.com/a.png", "alt": "demo", "width": 160, "height": 100 }
```

---

### Icon

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 偏差 | `name`（枚举或 path） | `icon` 任意字符串；另有 `size`/`color` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `icon` | `string` | 是 | — | 图标内容（常为 emoji/字符，对应 catalog `name`） |
| `size` | `small`\|`medium`\|`large` | 否 | `medium` | 尺寸 |
| `color` | `string` | 否 | `#333` | 颜色 |

```json
{ "id": "ico", "component": "Icon", "icon": "⭐", "size": "large", "color": "#42b983" }
```

---

### Video

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 偏差 | `url` | `src`；另有 `width`/`height` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `src` | `string` | 是 | — | 视频地址（对应 catalog `url`） |
| `width` | `string`\|`number` | 否 | `"100%"` | 宽度 |
| `height` | `string`\|`number` | 否 | `"auto"` | 高度 |

```json
{ "id": "vid", "component": "Video", "src": "https://example.com/a.mp4", "width": 200, "height": 120 }
```

---

### AudioPlayer

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 对齐 | `url`, `description` | 对齐 |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `url` | `string` \| `{path}` | 是 | — | 音频地址 |
| `description` | `string` \| `{path}` | 否 | — | 描述文案 |

```json
{ "id": "audio", "component": "AudioPlayer", "url": "https://example.com/a.mp3", "description": "Sample" }
```

---

## 3. 输入类

### Button

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 偏差 | `child` + `action`；`variant`: default\|primary\|borderless | `text`；`variant`: primary\|secondary\|danger\|ghost；另有 `size`/`disabled` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `text` | `string` | 是 | — | 按钮文案（未实现 child Text） |
| `variant` | `primary`\|`secondary`\|`danger`\|`ghost` | 否 | `primary` | 样式 |
| `size` | `small`\|`medium`\|`large` | 否 | `medium` | 尺寸 |
| `disabled` | `boolean` | 否 | `false` | 禁用 |

```json
{ "id": "btn", "component": "Button", "text": "Submit", "variant": "primary", "size": "medium" }
```

---

### TextField

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 偏差 | `variant`: longText\|number\|shortText\|obscured；`validationRegexp` | `type`: text\|password\|email\|number；另有 `placeholder`/`disabled`/`error` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `value` | `string` \| `{path}` | 否 | `""` | 绑定值，可写回 |
| `label` | `string` \| `{path}` | 否 | — | 标签 |
| `placeholder` | `string` | 否 | `""` | 占位符 |
| `type` | `text`\|`password`\|`email`\|`number` | 否 | `text` | 输入类型 |
| `disabled` | `boolean` | 否 | `false` | 禁用 |
| `error` | `string` | 否 | — | 错误提示 |

```json
{
  "id": "username",
  "component": "TextField",
  "label": "Username",
  "value": { "path": "/username" },
  "type": "text"
}
```

---

### CheckBox

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 对齐 | `label`, `value` | 对齐；另有 `disabled` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `value` | `boolean` \| `{path}` | 否 | `false` | 选中状态，可写回 |
| `label` | `string` \| `{path}` | 否 | — | 标签 |
| `disabled` | `boolean` | 否 | `false` | 禁用 |

```json
{ "id": "cb", "component": "CheckBox", "label": "Remember me", "value": { "path": "/remember" } }
```

---

### ChoicePicker

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 对齐 | 基本对齐 | 未实现 `checks` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `options` | `{ label: string, value: string }[]` | 是 | — | 选项列表 |
| `value` | `string[]` \| `{path}` | 是 | `[]` | 选中值列表，可写回 |
| `label` | `string` | 否 | — | 分组标签 |
| `variant` | `multipleSelection`\|`mutuallyExclusive` | 否 | `mutuallyExclusive` | 多选/单选 |
| `displayStyle` | `checkbox`\|`chips` | 否 | `checkbox` | 展示样式 |
| `filterable` | `boolean` | 否 | `false` | 是否可过滤 |

```json
{
  "id": "theme",
  "component": "ChoicePicker",
  "label": "Theme",
  "variant": "mutuallyExclusive",
  "displayStyle": "chips",
  "value": { "path": "/theme" },
  "options": [
    { "label": "Light", "value": "light" },
    { "label": "Dark", "value": "dark" }
  ]
}
```

---

### Slider

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 对齐 | `value`, `min`, `max`, `label` | 对齐；未实现 `checks` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `value` | `number` \| `{path}` | 是 | — | 当前值，可写回 |
| `max` | `number` | 是 | — | 最大值 |
| `min` | `number` | 否 | `0` | 最小值 |
| `label` | `string` | 否 | — | 标签 |

```json
{ "id": "vol", "component": "Slider", "label": "Volume", "value": { "path": "/volume" }, "min": 0, "max": 100 }
```

---

### DateTimeInput

| | Catalog | 当前 Renderer |
|--|---------|---------------|
| 偏差 | `enableDate`/`enableTime`/`min`/`max` | 简化为 `datetime-local`；另有 `disabled` |

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `value` | `string` \| `{path}` | 否 | `""` | ISO 本地日期时间，可写回 |
| `label` | `string` | 否 | — | 标签 |
| `disabled` | `boolean` | 否 | `false` | 禁用 |

```json
{ "id": "dt", "component": "DateTimeInput", "label": "Schedule", "value": { "path": "/when" } }
```

---

## 4. 布局类

### Column

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `children` | `string[]` | 是* | — | 子组件 ID 列表 |
| `justify` | `start`\|`center`\|`end`\|`spaceBetween`\|`spaceAround`\|`spaceEvenly`\|`stretch` | 否 | `start` | 主轴对齐 |
| `align` | `start`\|`center`\|`end`\|`stretch` | 否 | `stretch` | 交叉轴对齐 |

\*协议要求必填；渲染侧通过 slot 接收已解析子节点。

---

### Row

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `children` | `string[]` | 是* | — | 子组件 ID 列表 |
| `justify` | `start`\|`center`\|`end`\|`spaceBetween`\|`spaceAround`\|`spaceEvenly`\|`stretch` | 否 | `start` | 主轴对齐 |
| `align` | `start`\|`center`\|`end`\|`stretch` | 否 | `stretch` | 交叉轴对齐 |

与 catalog 基本对齐。

---

### List

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `children` | `string[]` | 是* | — | 子组件 ID 列表 |
| `direction` | `vertical`\|`horizontal` | 否 | `vertical` | 方向 |
| `align` | `start`\|`center`\|`end`\|`stretch` | 否 | `stretch` | 交叉轴对齐 |

> 暂不支持 catalog 的模板 children：`{ "componentId", "path" }`。

---

### Card

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `child` | `string` | 是 | — | 单个子组件 ID（多内容需先包 Column/Row） |

---

### Tabs

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `tabs` | `{ title: string, child: string }[]` | 是 | — | 至少 1 项；`title` 展示，`child` 为面板组件 ID |

面板内容按 `tabs` 顺序进入默认 slot。

---

### Modal

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `trigger` | `string` | 是 | — | 打开弹层的组件 ID |
| `content` | `string` | 是 | — | 弹层内容组件 ID |

Core 归一为 `children: [trigger, content]`；UI 点击 trigger 打开遮罩。

---

### Divider

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `axis` | `horizontal`\|`vertical` | 否 | `horizontal` | 分割线方向 |

与 catalog 对齐。

---

## 5. 与 basic_catalog 差异速查

| 组件 | Catalog 关键字段 | Renderer 实际字段 | 状态 |
|------|------------------|-------------------|------|
| Text | `text`, `variant` | 同左 | 对齐 |
| Image | `url`, `description`, `fit`, `variant` | `src`, `alt`, `width`, `height`, `borderRadius` | 偏差 |
| Icon | `name` | `icon`, `size`, `color` | 偏差 |
| Video | `url` | `src`, `width`, `height` | 偏差 |
| AudioPlayer | `url`, `description` | 同左 | 对齐 |
| Button | `child`, `action`, variant 枚举不同 | `text`, `variant`, `size`, `disabled` | 偏差 |
| TextField | `value`, `variant`(协议枚举) | `value`, `type`, `placeholder`, … | 部分对齐 |
| CheckBox | `label`, `value` | 同左 + `disabled` | 对齐 |
| ChoicePicker | options/value/variant/displayStyle | 同左 | 基本对齐 |
| Slider | value/min/max/label | 同左 | 对齐 |
| DateTimeInput | enableDate/Time/min/max | 简化 `value`/`label`/`disabled` | 简化 |
| Column/Row | children/justify/align | 同左 | 对齐 |
| List | children/direction/align | 同左（无模板 path） | 部分对齐 |
| Card | `child` | 同左 | 对齐 |
| Tabs | `tabs[]` | 同左 | 对齐 |
| Modal | trigger/content | 同左 | 对齐 |
| Divider | `axis` | 同左 | 对齐 |

---

## 6. 相关实现位置

| 模块 | 路径 |
|------|------|
| Renderer 注册 | [`packages/a2ui-vue/src/index.ts`](../packages/a2ui-vue/src/index.ts) |
| 组件实现 | [`packages/a2ui-vue/src/components/`](../packages/a2ui-vue/src/components/) |
| 消息解析 / 子节点归一 | [`packages/a2ui-core/src/parser/index.ts`](../packages/a2ui-core/src/parser/index.ts) |
| 数据绑定 | [`packages/a2ui-core/src/binding/`](../packages/a2ui-core/src/binding/) |
| 官方 Catalog | [`specification/v0_9/json/basic_catalog.json`](../specification/v0_9/json/basic_catalog.json) |

---

*文档版本：与仓库当前 `a2ui-vue` renderMap 同步。后续对齐 catalog 字段名时请同步更新本文件。*
