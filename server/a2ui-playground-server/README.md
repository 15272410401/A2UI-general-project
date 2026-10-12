# a2ui-playground-server

基于 **AG-UI + SSE** 的最小 A2UI Agent 服务。

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `POST` | `/agent` | 接收 AG-UI `RunAgentInput`，以 SSE 返回事件流 |

## 传输约定

- Content-Type: `text/event-stream`
- 每帧格式：`data: {json}\n\n`
- A2UI 通过 `ACTIVITY_SNAPSHOT` 下发：
  - `activityType: "a2ui-surface"`
  - `content.a2ui_operations: A2UIMessage[]`（累加，`replace: true`）

Mock 事件顺序：

1. `RUN_STARTED`
2. `STEP_STARTED`（`mock_a2ui_generate`）
3. `TEXT_MESSAGE_*`（简短状态文案）
4. 流式 `ACTIVITY_SNAPSHOT`（逐条累加 A2UI 操作）
5. `STEP_FINISHED` / `RUN_FINISHED`

## 启动

```bash
pnpm --filter a2ui-playground-server dev
# 或在仓库根目录：
pnpm dev:server
```

默认端口：`3001`（见 `.env.example`）。

## 示例

```bash
curl -N -X POST http://localhost:3001/agent \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "threadId": "t1",
    "runId": "r1",
    "messages": [{"id":"m1","role":"user","content":"购物车"}],
    "tools": [],
    "context": [],
    "state": {},
    "forwardedProps": {}
  }'
```

Mock 关键词：`购物车/cart` → shopping-cart，`登录/login` → login-form，默认 → local-action。
