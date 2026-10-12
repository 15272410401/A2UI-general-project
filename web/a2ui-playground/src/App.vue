<template>
  <div class="app-shell">
    <section class="preview-pane">
      <header class="preview-pane__header">
        <h1 class="preview-pane__title">Playground</h1>
        <div class="preview-pane__actions">
          <el-button type="primary" @click="openStoreDialog">查看 Store</el-button>
          <el-button @click="openAgentJsonDialog">查看 Agent JSON</el-button>
          <el-button @click="openErrorDialog">查看 Error</el-button>
          <el-button @click="resetPlayground">重置</el-button>
        </div>
      </header>

      <div v-if="renderError" class="preview-pane__error">
        <el-alert type="error" :title="renderError" show-icon />
      </div>

      <div class="preview-pane__body">
        <div
          v-show="!hasPreviewContent"
          class="preview-pane__placeholder"
        >
          在右侧与 Agent 对话后，A2UI 界面将在此预览
        </div>
        <div ref="previewRef" class="preview-pane__canvas"></div>
      </div>
    </section>

    <ChatPanel
      ref="chatPanelRef"
      class="chat-pane"
      :messages="chatMessages"
      :loading="isAgentStreaming"
      :model-chat-only="modelChatOnly"
      @update:model-chat-only="modelChatOnly = $event"
      @send="sendChatMessage"
    />

    <el-dialog
      title="A2UI Store"
      v-model="dialogVisible"
      width="880px"
      :before-close="handleClose"
      class="store-dialog"
    >
      <el-tabs v-model="storeTab" type="border-card">
        <el-tab-pane name="dataModel">
          <template #label>
            DataModel
            <el-tag size="small" type="info" class="tab-count">{{
              dataModelCount
            }}</el-tag>
          </template>
          <pre class="store-pre">{{
            formatJson(storeState.dataModelMap)
          }}</pre>
        </el-tab-pane>

        <el-tab-pane name="surfaces">
          <template #label>
            Surfaces
            <el-tag size="small" type="info" class="tab-count">{{
              surfaceCount
            }}</el-tag>
          </template>
          <pre class="store-pre">{{ formatJson(storeState.surfaceMap) }}</pre>
        </el-tab-pane>

        <el-tab-pane name="hydrate">
          <template #label>
            HydrateNodes
            <el-tag size="small" type="info" class="tab-count">{{
              hydrateCount
            }}</el-tag>
          </template>
          <pre class="store-pre">{{
            formatJson(storeState.hydrateNodeMap)
          }}</pre>
        </el-tab-pane>

        <el-tab-pane name="tree">
          <template #label>
            ComponentTrees
            <el-tag size="small" type="info" class="tab-count">{{
              treeCount
            }}</el-tag>
          </template>
          <pre class="store-pre">{{
            formatJson(storeState.componentTreeMap)
          }}</pre>
        </el-tab-pane>

        <el-tab-pane name="error" label="Error">
          <pre class="store-pre">{{ formatJson(storeState.errorInfo) }}</pre>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <el-dialog
      title="Agent JSON"
      v-model="agentJsonDialogVisible"
      width="880px"
      :before-close="handleAgentJsonClose"
    >
      <div v-if="!agentRawJson.trim() && agentOperations.length === 0" class="no-error">
        <el-empty description="暂无 Agent 返回的 A2UI 元素数据" />
      </div>
      <div v-else class="agent-json-dialog">
        <section class="agent-json-section">
          <h3 class="agent-json-section__title">本轮 Agent 返回（首轮全量 / 微调增量）</h3>
          <pre class="store-pre">{{ agentRawJsonView }}</pre>
        </section>
        <section class="agent-json-section">
          <h3 class="agent-json-section__title">本轮流式 JSONL（最小单元）</h3>
          <pre class="store-pre">{{ agentStreamJsonl }}</pre>
        </section>
        <section v-if="agentDocumentJson.trim()" class="agent-json-section">
          <h3 class="agent-json-section__title">合并后完整文档</h3>
          <pre class="store-pre">{{ agentDocumentJsonView }}</pre>
        </section>
      </div>
    </el-dialog>

    <el-dialog
      title="Error Info"
      v-model="errorDialogVisible"
      width="600px"
      :before-close="handleErrorClose"
    >
      <div v-if="storeState.errorInfo" class="error-content">
        <el-alert
          :type="errorType"
          :title="storeState.errorInfo.type"
          :description="storeState.errorInfo.content"
          show-icon
        />
      </div>
      <div v-else class="no-error">
        <el-empty description="暂无错误信息" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { createVNode, render, type VNode } from "vue";
import { ElMessage } from "element-plus";
import {
  init,
  parseMessage,
  writeDataModelValue,
  handleClientAction,
  resolveProps,
  StreamBuffer,
  type Surface,
  type HydrateNode,
  type ComponentTreeNode,
} from "@a2ui/core";
import { renderMap } from "@a2ui/vue";
import ChatPanel from "./components/ChatPanel.vue";
import type { ChatMessage, ChatSendPayload } from "./types/chat";

interface StoreState {
  surfaceMap: Record<string, Surface>;
  hydrateNodeMap: Record<string, HydrateNode>;
  componentTreeMap: Record<string, ComponentTreeNode[]>;
  dataModelMap: Record<string, unknown>;
  errorInfo: { type: string; content: string } | null;
}

const dialogVisible = ref(false);
const errorDialogVisible = ref(false);
const agentJsonDialogVisible = ref(false);
const storeTab = ref("dataModel");
const previewRef = ref<HTMLDivElement | null>(null);
const chatPanelRef = ref<{
  addComponentId: (id: string) => void;
} | null>(null);

const renderError = ref<string | null>(null);
const isAgentStreaming = ref(false);
const modelChatOnly = ref(false);
const chatMessages = ref<ChatMessage[]>([]);
/** 稳定 thread，多轮微调共用；重置时换新 */
const agentThreadId = ref(`thread-${Date.now()}`);
/** Agent 最近一次用于渲染的 A2UI 信封列表（已与历史合并的全量最小单元） */
const agentOperations = ref<unknown[]>([]);
/** 本轮 Agent 流式原始输出（首轮=全量 JSON，微调轮=增量 JSON） */
const agentRawJson = ref("");
/** 合并后的完整文档 {"messages":[...]}，多轮微调的结构真源 */
const agentDocumentJson = ref("");
/** 本轮 ACTIVITY_SNAPSHOT 已应用到 store 的操作条数（增量防重复 parse） */
let appliedOpsThisTurn = 0;

const storeState = ref<StoreState>({
  surfaceMap: {},
  hydrateNodeMap: {},
  componentTreeMap: {},
  dataModelMap: {},
  errorInfo: null,
});

const errorType = computed(() => {
  if (!storeState.value.errorInfo) return "info";
  return storeState.value.errorInfo.type === "RENDER_ERROR"
    ? "error"
    : "warning";
});

const surfaceCount = computed(
  () => Object.keys(storeState.value.surfaceMap).length,
);
const hydrateCount = computed(
  () => Object.keys(storeState.value.hydrateNodeMap).length,
);
const treeCount = computed(
  () => Object.keys(storeState.value.componentTreeMap).length,
);
const dataModelCount = computed(
  () => Object.keys(storeState.value.dataModelMap).length,
);

/** 是否已有可预览的组件树 */
const hasPreviewContent = computed(() => {
  const trees = storeState.value.componentTreeMap;
  return Object.keys(trees).some((id) => (trees[id]?.length ?? 0) > 0);
});

/** Agent 原始 JSON：能 parse 则格式化，否则原样展示 */
const agentRawJsonView = computed(() => {
  const raw = agentRawJson.value.trim();
  if (!raw) return "（尚无内容）";
  try {
    return formatJson(JSON.parse(raw));
  } catch {
    return agentRawJson.value;
  }
});

const agentDocumentJsonView = computed(() => {
  const raw = agentDocumentJson.value.trim();
  if (!raw) return "（尚无合并文档）";
  try {
    return formatJson(JSON.parse(raw));
  } catch {
    return agentDocumentJson.value;
  }
});

/**
 * 用 StreamBuffer 把本轮 Agent JSON 转成流式渲染最小单元 JSONL
 *（createSurface / updateDataModel 各一行；updateComponents 每个 component 一行）
 */
const agentStreamJsonl = computed(() => {
  const raw = agentRawJson.value;
  if (!raw.trim()) return "（尚无可转换的 JSONL）";
  const buffer = new StreamBuffer();
  buffer.append(raw);
  const lines = buffer.extract();
  return lines.length > 0 ? lines.join("\n") : "（等待可消费的最小单元…）";
});

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

let store: ReturnType<typeof init> | null = null;

/** Ctrl/Cmd + 左键：选中组件 id 插入对话区，并拦截以免触发 Button 等业务点击 */
function onPreviewClickCapture(event: MouseEvent) {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.button !== 0) return;
  const target = event.target as HTMLElement | null;
  const host = target?.closest?.("[data-a2ui-id]") as HTMLElement | null;
  if (!host) return;
  const id = host.getAttribute("data-a2ui-id");
  if (!id) return;
  event.preventDefault();
  event.stopPropagation();
  onSelectComponentId(id);
}

onMounted(() => {
  store = init(renderMap);
  updateStoreState();
  previewRef.value?.addEventListener("click", onPreviewClickCapture, true);
});

onUnmounted(() => {
  previewRef.value?.removeEventListener("click", onPreviewClickCapture, true);
});

function openStoreDialog() {
  updateStoreState();
  storeTab.value = "dataModel";
  dialogVisible.value = true;
}

function handleClose() {
  dialogVisible.value = false;
}

function openErrorDialog() {
  updateStoreState();
  errorDialogVisible.value = true;
}

function handleErrorClose() {
  errorDialogVisible.value = false;
}

function openAgentJsonDialog() {
  agentJsonDialogVisible.value = true;
}

function handleAgentJsonClose() {
  agentJsonDialogVisible.value = false;
}

function updateStoreState() {
  if (store) {
    const state = store.getState();
    storeState.value = {
      surfaceMap: state.surfaceMap,
      hydrateNodeMap: state.hydrateNodeMap,
      componentTreeMap: state.componentTreeMap,
      dataModelMap: state.dataModelMap,
      errorInfo: state.errorInfo,
    };
    renderError.value =
      state.errorInfo?.type === "RENDER_ERROR" ? state.errorInfo.content : null;
  }
}

const A2UI_OPERATIONS_KEY = "a2ui_operations";
const AGENT_URL = "/agent";
const CHAT_URL = "/chat";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasCreateSurface(operations: unknown[]): boolean {
  return operations.some((op) => isRecord(op) && "createSurface" in op);
}

/** 将增量信封合并进已有最小单元列表 */
function mergeOperations(base: unknown[], delta: unknown[]): unknown[] {
  const result = [...base];

  for (const op of delta) {
    if (!isRecord(op)) continue;

    if ("createSurface" in op) {
      const idx = result.findIndex((r) => isRecord(r) && "createSurface" in r);
      if (idx >= 0) result[idx] = op;
      else result.unshift(op);
      continue;
    }

    if ("updateDataModel" in op) {
      const udm = op.updateDataModel as Record<string, unknown>;
      const path = typeof udm.path === "string" ? udm.path : "";
      const idx = result.findIndex((r) => {
        if (!isRecord(r) || !("updateDataModel" in r)) return false;
        const other = r.updateDataModel as Record<string, unknown>;
        const otherPath = typeof other.path === "string" ? other.path : "";
        return otherPath === path;
      });
      if (idx >= 0) result[idx] = op;
      else result.push(op);
      continue;
    }

    if ("updateComponents" in op) {
      const uc = op.updateComponents as Record<string, unknown>;
      const components = Array.isArray(uc.components) ? uc.components : [];
      const surfaceId = uc.surfaceId;
      for (const component of components) {
        if (!isRecord(component) || typeof component.id !== "string") continue;
        const envelope = {
          version: op.version ?? "v0.9",
          updateComponents: {
            surfaceId,
            components: [component],
          },
        };
        const idx = result.findIndex((r) => {
          if (!isRecord(r) || !("updateComponents" in r)) return false;
          const ruc = r.updateComponents as Record<string, unknown>;
          const comps = Array.isArray(ruc.components) ? ruc.components : [];
          const first = comps[0];
          return isRecord(first) && first.id === component.id;
        });
        if (idx >= 0) result[idx] = envelope;
        else result.push(envelope);
      }
      continue;
    }

    if ("deleteSurface" in op) {
      result.push(op);
    }
  }

  return result;
}

/** 从最小单元列表重建供模型阅读的完整 {"messages":[...]} */
function rebuildDocumentJson(operations: unknown[]): string {
  let createSurface: unknown | null = null;
  const dataModels: unknown[] = [];
  const componentById = new Map<string, Record<string, unknown>>();
  let surfaceId = "main";
  const others: unknown[] = [];

  for (const op of operations) {
    if (!isRecord(op)) continue;
    if ("createSurface" in op) {
      createSurface = op;
      const cs = op.createSurface as Record<string, unknown>;
      if (typeof cs.surfaceId === "string") surfaceId = cs.surfaceId;
      continue;
    }
    if ("updateDataModel" in op) {
      dataModels.push(op);
      continue;
    }
    if ("updateComponents" in op) {
      const uc = op.updateComponents as Record<string, unknown>;
      if (typeof uc.surfaceId === "string") surfaceId = uc.surfaceId;
      const components = Array.isArray(uc.components) ? uc.components : [];
      for (const c of components) {
        if (isRecord(c) && typeof c.id === "string") {
          componentById.set(c.id, c);
        }
      }
      continue;
    }
    others.push(op);
  }

  const messages: unknown[] = [];
  if (createSurface) messages.push(createSurface);
  messages.push(...dataModels);
  if (componentById.size > 0) {
    // root 优先，其余按插入顺序
    const comps = [...componentById.values()];
    comps.sort((a, b) => {
      if (a.id === "root") return -1;
      if (b.id === "root") return 1;
      return 0;
    });
    messages.push({
      version: "v0.9",
      updateComponents: {
        surfaceId,
        components: comps,
      },
    });
  }
  messages.push(...others);

  return JSON.stringify({ messages });
}

/**
 * 应用 A2UI 操作。
 * replace / 含 createSurface：整表重建；否则增量 parseMessage 并与原文拼接。
 */
function applyA2uiOperations(
  operations: unknown[],
  snapshotReplace = true,
) {
  if (!store) return;

  const fullReplace =
    snapshotReplace ||
    hasCreateSurface(operations) ||
    agentOperations.value.length === 0;

  if (fullReplace) {
    store.getState().clearSurfaces();
    store.getState().clearHydrateNodes();
    store.getState().clearComponentTrees();
    store.getState().clearDataModels();
    store.getState().clearError();
    appliedOpsThisTurn = 0;
    agentOperations.value = operations;
    for (const message of operations) {
      parseMessage(message);
    }
    appliedOpsThisTurn = operations.length;
  } else {
    const fresh = operations.slice(appliedOpsThisTurn);
    for (const message of fresh) {
      parseMessage(message);
    }
    appliedOpsThisTurn = operations.length;
    if (fresh.length > 0) {
      agentOperations.value = mergeOperations(agentOperations.value, fresh);
    }
  }

  agentDocumentJson.value = rebuildDocumentJson(agentOperations.value);
  updateStoreState();
  renderPreview();
}

/** 从对话区发送消息并拉取 Agent SSE */
async function sendChatMessage(payload: ChatSendPayload) {
  const text = payload.text.trim();
  const images = modelChatOnly.value ? [] : payload.images;
  if ((!text && images.length === 0) || isAgentStreaming.value) return;

  const userId = `user-${Date.now()}`;
  const assistantId = `assistant-${Date.now()}`;
  const displayText = text || "请根据图片生成界面";

  // 发送前快照完整文档，供多轮微调（之后才清空本轮累计）
  const currentA2uiJson = modelChatOnly.value
    ? ""
    : agentDocumentJson.value.trim() || agentRawJson.value.trim();

  chatMessages.value = [
    ...chatMessages.value,
    {
      id: userId,
      role: "user",
      content: displayText,
      status: "done",
      images: images.length ? images : undefined,
    },
    {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
    },
  ];

  isAgentStreaming.value = true;
  appliedOpsThisTurn = 0;
  if (!modelChatOnly.value) {
    // 保留预览到增量应用；仅清空本轮原始输出累计
    agentRawJson.value = "";
  }

  const history = chatMessages.value
    .filter(
      (msg) =>
        msg.id !== assistantId && msg.status !== "error" && msg.content,
    )
    .map((msg) => ({ role: msg.role, content: msg.content }));

  const body = modelChatOnly.value
    ? { messages: history }
    : {
        threadId: agentThreadId.value,
        runId: `run-${Date.now()}`,
        messages: history.map((msg, index) => ({
          id: `${msg.role}-${index}-${Date.now()}`,
          role: msg.role,
          content: msg.content,
        })),
        currentA2uiJson: currentA2uiJson || undefined,
        images,
        tools: [],
        context: [],
        state: {},
        forwardedProps: {},
      };

  try {
    const response = await fetch(modelChatOnly.value ? CHAT_URL : AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }
    if (!response.body) {
      throw new Error("响应体为空");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const dataLine = part
          .split("\n")
          .map((line) => line.trimEnd())
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;

        const jsonText = dataLine.slice(5).trim();
        if (!jsonText) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(jsonText) as Record<string, unknown>;
        } catch {
          continue;
        }

        const type = String(event.type ?? "UNKNOWN");
        if (type === "TEXT_MESSAGE_CONTENT") {
          const delta = String(event.delta ?? "");
          if (delta) {
            appendAssistantDelta(assistantId, delta);
            if (!modelChatOnly.value) {
              agentRawJson.value += delta;
            }
          }
        } else if (!modelChatOnly.value && type === "ACTIVITY_SNAPSHOT") {
          const content = event.content as Record<string, unknown> | undefined;
          const ops = content?.[A2UI_OPERATIONS_KEY];
          if (Array.isArray(ops)) {
            applyA2uiOperations(ops, event.replace !== false);
          }
        } else if (type === "RUN_ERROR") {
          const message = String(event.message ?? "Agent RUN_ERROR");
          markAssistantError(assistantId, message);
          ElMessage.error(message);
        }
      }
    }

    finishAssistant(assistantId, "（模型没有返回内容）");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markAssistantError(assistantId, message);
    ElMessage.error(message);
  } finally {
    isAgentStreaming.value = false;
  }
}

function appendAssistantDelta(assistantId: string, delta: string) {
  chatMessages.value = chatMessages.value.map((msg) =>
    msg.id === assistantId
      ? { ...msg, content: msg.content + delta, status: "streaming" }
      : msg,
  );
}

function finishAssistant(assistantId: string, emptyText = "（模型没有返回内容）") {
  chatMessages.value = chatMessages.value.map((msg) => {
    if (msg.id !== assistantId || msg.status === "error") return msg;
    return {
      ...msg,
      content: msg.content || emptyText,
      status: "done",
    };
  });
}

function markAssistantError(assistantId: string, message: string) {
  chatMessages.value = chatMessages.value.map((msg) =>
    msg.id === assistantId
      ? { ...msg, content: message, status: "error" }
      : msg,
  );
}

function clearAll() {
  if (store) {
    store.getState().clearSurfaces();
    store.getState().clearHydrateNodes();
    store.getState().clearComponentTrees();
    store.getState().clearDataModels();
    store.getState().clearError();
    updateStoreState();
  }
  if (previewRef.value) {
    render(null, previewRef.value);
  }
  renderError.value = null;
  agentOperations.value = [];
  agentRawJson.value = "";
  agentDocumentJson.value = "";
  appliedOpsThisTurn = 0;
}

/** 恢复到初始状态：清空对话与预览，开启新 thread */
function resetPlayground() {
  if (isAgentStreaming.value) {
    ElMessage.warning("Agent 正在生成中，请稍后再重置");
    return;
  }
  chatMessages.value = [];
  agentThreadId.value = `thread-${Date.now()}`;
  clearAll();
  ElMessage.success("已重置");
}

function renderPreview() {
  if (!previewRef.value) return;

  const trees = storeState.value.componentTreeMap;
  const surfaceIds = Object.keys(trees);

  if (surfaceIds.length === 0) {
    render(null, previewRef.value);
    return;
  }

  const activeSurfaceId = surfaceIds[0];
  const nodes = trees[activeSurfaceId];
  if (!nodes || nodes.length === 0) {
    render(null, previewRef.value);
    return;
  }

  const vnodes = nodes.map((node) =>
    createVNodeFromTree(node, activeSurfaceId),
  );
  const container = createVNode("div", { class: "preview-content" }, vnodes);
  render(container, previewRef.value);
  markNodesMounted(nodes);
}

function markNodesMounted(nodes: ComponentTreeNode[]) {
  if (!store) return;
  for (const node of nodes) {
    if (!node.hasMounted) {
      store.getState().updateHydrateNode(node.componentId, { hasMounted: true });
    }
    markNodesMounted(node.children);
  }
}

function mergeClassName(
  props: Record<string, unknown>,
  extraClass: string | undefined,
): Record<string, unknown> {
  if (!extraClass) return props;

  const existing = props.class;
  let merged: string;
  if (typeof existing === "string" && existing.length > 0) {
    merged = `${existing} ${extraClass}`;
  } else if (Array.isArray(existing)) {
    merged = [...existing, extraClass].filter(Boolean).join(" ");
  } else {
    merged = extraClass;
  }

  return { ...props, class: merged };
}

function attachBindingHandlers(
  props: Record<string, unknown>,
  propBindings: Record<string, string> | undefined,
  surfaceId: string,
): Record<string, unknown> {
  if (!propBindings) return props;

  const next = { ...props };
  for (const [propName, path] of Object.entries(propBindings)) {
    const eventKey = `onUpdate:${propName}`;
    next[eventKey] = (value: unknown) => {
      writeDataModelValue(surfaceId, path, value);
      updateStoreState();
      renderPreview();
    };
  }
  return next;
}

function attachActionHandler(
  props: Record<string, unknown>,
  surfaceId: string,
): Record<string, unknown> {
  const action = props.action;
  if (!action) return props;

  return {
    ...props,
    onAction: (payload: unknown) => {
      const result = handleClientAction(surfaceId, payload ?? action);
      if (result === "local") {
        updateStoreState();
        renderPreview();
      }
    },
  };
}

function onSelectComponentId(componentId: string) {
  chatPanelRef.value?.addComponentId(componentId);
}

function createVNodeFromTree(
  node: ComponentTreeNode,
  surfaceId: string,
): VNode {
  const { component, children, propBindings } = node;
  // 渲染值一律从 store.dataModelMap 解析，不使用树里的快照
  const dataModel = store?.getState().getDataModel(surfaceId) ?? {};
  const { props: resolvedProps } = resolveProps(
    (node.props as Record<string, unknown>) || {},
    dataModel,
  );

  const hasMounted =
    store?.getState().getHydrateNode(node.componentId)?.hasMounted ??
    node.hasMounted;
  const fadeClass = hasMounted ? undefined : "a2ui-fade-in";
  let mergedProps = mergeClassName(
    {
      ...resolvedProps,
      key: node.componentId,
      // 供 Ctrl/Cmd+点击定位，不改变视觉结构
      "data-a2ui-id": node.componentId,
    },
    fadeClass,
  );
  mergedProps = attachBindingHandlers(mergedProps, propBindings, surfaceId);
  mergedProps = attachActionHandler(mergedProps, surfaceId);

  if (!component) {
    return createVNode(
      "span",
      mergedProps,
      "Component not found: " + node.tag,
    );
  }

  const childrenVnodes: VNode[] = children.map((child) =>
    createVNodeFromTree(child, surfaceId),
  );

  return createVNode(component, mergedProps, childrenVnodes);
}
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: #eef1f4;
}

.preview-pane {
  flex: 1 1 auto;
  width: 80%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}

.preview-pane__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.preview-pane__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.preview-pane__actions {
  display: flex;
  gap: 10px;
}

.preview-pane__error {
  flex-shrink: 0;
  padding: 8px 20px 0;
}

.preview-pane__body {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 16px 20px 20px;
  padding: 20px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: auto;
  /* 预留滚动条空间，避免出现/消失时布局闪动 */
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #c5cad3 transparent;
}

.preview-pane__body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.preview-pane__body::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px;
}

.preview-pane__body::-webkit-scrollbar-thumb {
  background: #c5cad3;
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.preview-pane__body::-webkit-scrollbar-thumb:hover {
  background: #9aa3b2;
  background-clip: content-box;
  border: 2px solid transparent;
}

.preview-pane__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  pointer-events: none;
  z-index: 1;
}

.preview-pane__canvas {
  position: relative;
  z-index: 2;
  min-height: 100%;
  padding: 0;
}

.chat-pane {
  flex: 0 0 20%;
  min-width: 280px;
  max-width: 420px;
}

.error-content {
  margin-top: 16px;
}

.no-error {
  padding: 40px 0;
}

.store-pre {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  overflow: auto;
  max-height: 56vh;
  font-size: 13px;
  margin: 0;
  line-height: 1.45;
}

.agent-json-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-json-section__title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.agent-json-section .store-pre {
  max-height: 36vh;
}

.tab-count {
  margin-left: 6px;
  vertical-align: middle;
}
</style>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
}

.a2ui-fade-in {
  animation: a2ui-fade-in 0.2s ease;
}

@keyframes a2ui-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 动态 vnode 预览容器（非 scoped） */
.preview-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
