<template>
  <button :class="buttonClass" :style="rootStyle" @click="handleClick">
    {{ text }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  text: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  /** 协议 Action：event（服务端）或 functionCall（本地） */
  action?: Record<string, unknown>
  style?: A2uiStyle
}>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false
})

const emit = defineEmits<{
  click: []
  action: [action: Record<string, unknown>]
}>()

const rootStyle = computed(() => normalizeStyle(props.style))

const buttonClass = computed(() => [
  'a2ui-button',
  `a2ui-button--${props.variant}`,
  `a2ui-button--${props.size}`,
  { 'a2ui-button--disabled': props.disabled }
])

const handleClick = () => {
  if (!props.disabled) {
    emit('click')
    if (props.action) {
      emit('action', props.action)
    }
  }
}
</script>

<style scoped>
.a2ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.a2ui-button--primary {
  background-color: #42b983;
  color: white;
}

.a2ui-button--primary:hover:not(.a2ui-button--disabled) {
  background-color: #379a6b;
}

.a2ui-button--secondary {
  background-color: #6b7280;
  color: white;
}

.a2ui-button--secondary:hover:not(.a2ui-button--disabled) {
  background-color: #4b5563;
}

.a2ui-button--danger {
  background-color: #ef4444;
  color: white;
}

.a2ui-button--danger:hover:not(.a2ui-button--disabled) {
  background-color: #dc2626;
}

.a2ui-button--ghost {
  background-color: transparent;
  color: #374151;
  border: 1px solid #d1d5db;
}

.a2ui-button--ghost:hover:not(.a2ui-button--disabled) {
  background-color: #f3f4f6;
}

.a2ui-button--small {
  padding: 4px 8px;
  font-size: 12px;
}

.a2ui-button--medium {
  padding: 8px 16px;
  font-size: 14px;
}

.a2ui-button--large {
  padding: 12px 24px;
  font-size: 16px;
}

.a2ui-button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>