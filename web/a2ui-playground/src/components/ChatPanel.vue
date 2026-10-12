<template>
  <aside class="chat-panel">
    <header class="chat-panel__header">
      <div class="chat-panel__title-row">
        <h2 class="chat-panel__title">Agent 对话</h2>
        <label class="chat-panel__switch">
          <span>仅模型对话</span>
          <el-switch
            :model-value="modelChatOnly"
            :disabled="loading"
            @change="onToggleModelChat"
          />
        </label>
      </div>
      <p class="chat-panel__desc">
        {{
          modelChatOnly
            ? "已开启：只测试模型对话，不会更新左侧预览"
            : "描述界面或上传截图，左侧将按 A2UI 协议流式渲染；微调时可用 Ctrl+点击组件插入 id"
        }}
      </p>
    </header>

    <div class="chat-panel__list-wrap">
    <div ref="listRef" class="chat-panel__messages">
      <div v-if="messages.length === 0" class="chat-panel__empty">
        {{
          modelChatOnly
            ? "开关已打开，直接发一句话测试模型回复"
            : "描述一个界面，或上传截图让 Agent 还原"
        }}
      </div>
      <div
        v-for="msg in messages"
        v-show="isMessageVisible(msg)"
        :key="msg.id"
        class="chat-panel__row"
        :class="`chat-panel__row--${msg.role}`"
      >
        <div class="chat-panel__bubble" :class="`chat-panel__bubble--${msg.role}`">
          <div v-if="msg.images?.length" class="chat-panel__thumbs">
            <img
              v-for="(src, index) in msg.images"
              :key="index"
              :src="src"
              alt=""
              class="chat-panel__thumb"
            />
          </div>
          <span v-if="msg.content">{{ msg.content }}</span>
        </div>
      </div>
    </div>
      <div v-if="showWaiting" class="chat-panel__waiting" role="status">
        <span class="chat-panel__spinner" aria-hidden="true" />
        <p class="chat-panel__waiting-text">{{ waitingText }}</p>
      </div>
    </div>

    <footer class="chat-panel__composer">
      <div v-if="selectedComponentIds.length" class="chat-panel__id-chips">
        <span
          v-for="id in selectedComponentIds"
          :key="id"
          class="chat-panel__id-chip"
        >
          {{ id }}
          <button
            type="button"
            class="chat-panel__id-chip-clear"
            title="清除"
            @click="removeComponentId(id)"
          >
            ×
          </button>
        </span>
      </div>
      <div v-if="!modelChatOnly && pendingImages.length" class="chat-panel__pending">
        <div
          v-for="(src, index) in pendingImages"
          :key="index"
          class="chat-panel__pending-item"
        >
          <img :src="src" alt="" />
          <button type="button" @click="removeImage(index)">×</button>
        </div>
      </div>
      <el-input
        v-model="draft"
        type="textarea"
        :rows="3"
        resize="none"
        :disabled="loading"
        :placeholder="
          modelChatOnly
            ? '输入任意问题，测试模型是否连通'
            : '描述你想生成的界面，也可附上截图；Ctrl+点击预览组件可插入 id'
        "
        @keydown="onKeydown"
      />
      <div class="chat-panel__actions">
        <el-button
          v-if="!modelChatOnly"
          :disabled="loading || pendingImages.length >= 4"
          @click="pickImages"
        >
          上传图片
        </el-button>
        <input
          ref="fileRef"
          class="chat-panel__file"
          type="file"
          accept="image/*"
          multiple
          @change="onFiles"
        />
        <el-button
          type="primary"
          class="chat-panel__send"
          :loading="loading"
          :disabled="loading || !canSend"
          @click="onSend"
        >
          发送
        </el-button>
      </div>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { ChatMessage, ChatSendPayload } from "../types/chat";

const props = defineProps<{
  messages: ChatMessage[];
  loading: boolean;
  modelChatOnly: boolean;
}>();

const emit = defineEmits<{
  send: [payload: ChatSendPayload];
  "update:modelChatOnly": [value: boolean];
}>();

const draft = ref("");
const pendingImages = ref<string[]>([]);
const selectedComponentIds = ref<string[]>([]);
const fileRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLDivElement | null>(null);

const canSend = computed(() => {
  if (draft.value.trim().length > 0) return true;
  if (selectedComponentIds.value.length > 0) return true;
  return !props.modelChatOnly && pendingImages.value.length > 0;
});

const waitingText = computed(() =>
  props.modelChatOnly ? "正在等待模型回复" : "正在生成界面",
);

const showWaiting = computed(() => {
  if (!props.loading) return false;
  const pending = [...props.messages]
    .reverse()
    .find((msg) => msg.role === "assistant" && msg.status === "streaming");
  return !pending?.content;
});

watch(
  () => props.messages,
  async () => {
    await nextTick();
    const el = listRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  },
  { deep: true },
);

watch(
  () => props.modelChatOnly,
  (value) => {
    if (value) selectedComponentIds.value = [];
  },
);

function isMessageVisible(msg: ChatMessage) {
  if (msg.role === "assistant" && msg.status === "streaming" && !msg.content) {
    return false;
  }
  return true;
}

function addComponentId(id: string) {
  if (props.modelChatOnly || props.loading) return;
  const trimmed = id.trim();
  if (!trimmed) return;
  if (selectedComponentIds.value.includes(trimmed)) return;
  selectedComponentIds.value = [...selectedComponentIds.value, trimmed];
}

function removeComponentId(id: string) {
  selectedComponentIds.value = selectedComponentIds.value.filter(
    (item) => item !== id,
  );
}

function onToggleModelChat(value: string | number | boolean) {
  emit("update:modelChatOnly", Boolean(value));
}

function pickImages() {
  fileRef.value?.click();
}

function removeImage(index: number) {
  pendingImages.value = pendingImages.value.filter((_, i) => i !== index);
}

function onFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = "";
  const room = 4 - pendingImages.value.length;
  for (const file of files.slice(0, room)) {
    if (!file.type.startsWith("image/") || file.size > 1_500_000) continue;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        pendingImages.value = [...pendingImages.value, reader.result].slice(0, 4);
      }
    };
    reader.readAsDataURL(file);
  }
}

function onSend() {
  const text = draft.value.trim();
  const images = props.modelChatOnly ? [] : [...pendingImages.value];
  const ids = [...selectedComponentIds.value];
  if ((!text && images.length === 0 && ids.length === 0) || props.loading) {
    return;
  }

  let content = text;
  if (ids.length > 0) {
    const idList = ids.map((id) => `id="${id}"`).join("、");
    content = text
      ? `请针对组件 ${idList} 进行调整：${text}`
      : `请针对组件 ${idList} 进行调整。`;
  }

  emit("send", { text: content, images });
  draft.value = "";
  pendingImages.value = [];
  selectedComponentIds.value = [];
}

function onKeydown(event: Event | KeyboardEvent) {
  const e = event as KeyboardEvent;
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    onSend();
  }
}

defineExpose({
  addComponentId,
});
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 280px;
  background: #f8fafc;
  border-left: 1px solid #e5e7eb;
}

.chat-panel__header {
  flex-shrink: 0;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.chat-panel__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.chat-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.chat-panel__switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #4b5563;
  white-space: nowrap;
}

.chat-panel__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
}

.chat-panel__list-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chat-panel__messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* 预留滚动条空间，避免出现/消失时气泡区域闪动 */
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #c5cad3 transparent;
}

.chat-panel__messages::-webkit-scrollbar {
  width: 8px;
}

.chat-panel__messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-panel__messages::-webkit-scrollbar-thumb {
  background: #c5cad3;
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.chat-panel__messages::-webkit-scrollbar-thumb:hover {
  background: #9aa3b2;
  background-clip: content-box;
  border: 2px solid transparent;
}

.chat-panel__empty {
  margin: auto;
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.5;
}

.chat-panel__row {
  display: flex;
}

.chat-panel__row--user {
  justify-content: flex-end;
}

.chat-panel__row--assistant {
  justify-content: flex-start;
}

.chat-panel__bubble {
  max-width: 92%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-panel__bubble--user {
  background: #42b983;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.chat-panel__bubble--assistant {
  background: #fff;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
}

.chat-panel__waiting {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(248, 250, 252, 0.88);
}

.chat-panel__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #42b983;
  border-radius: 50%;
  animation: chat-panel-spin 0.8s linear infinite;
}

.chat-panel__waiting-text {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

@keyframes chat-panel-spin {
  to {
    transform: rotate(360deg);
  }
}

.chat-panel__composer {
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-panel__id-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-panel__id-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 4px 18px 4px 8px;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  background: #f0fdf4;
  color: #166534;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.4;
  word-break: break-all;
}

.chat-panel__id-chip-clear {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}

.chat-panel__id-chip-clear:hover {
  background: #374151;
}

.chat-panel__actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.chat-panel__send {
  margin-left: auto;
}

.chat-panel__file {
  display: none;
}

.chat-panel__pending {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chat-panel__pending-item {
  position: relative;
  width: 56px;
  height: 56px;
}

.chat-panel__pending-item img,
.chat-panel__thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.chat-panel__pending-item button {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  cursor: pointer;
  line-height: 18px;
  padding: 0;
}

.chat-panel__thumbs {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
</style>
