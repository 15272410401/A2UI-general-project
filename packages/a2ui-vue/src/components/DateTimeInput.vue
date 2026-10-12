<template>
  <div :class="wrapperClass" :style="rootStyle">
    <label v-if="label" :class="labelClass">{{ label }}</label>
    <input
      type="datetime-local"
      :value="value"
      :disabled="disabled"
      :class="inputClass"
      @input="handleInput"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  value?: string
  label?: string
  disabled?: boolean
  style?: A2uiStyle
}>(), {
  value: '',
  disabled: false
})

const emit = defineEmits<{
  'update:value': [value: string]
}>()

const wrapperClass = computed(() => 'a2ui-datetime-input')
const rootStyle = computed(() => normalizeStyle(props.style))

const labelClass = computed(() => 'a2ui-datetime-input__label')

const inputClass = computed(() => [
  'a2ui-datetime-input__input',
  { 'a2ui-datetime-input__input--disabled': props.disabled }
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:value', target.value)
}
</script>

<style scoped>
.a2ui-datetime-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.a2ui-datetime-input__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.a2ui-datetime-input__input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.a2ui-datetime-input__input:focus {
  outline: none;
  border-color: #42b983;
}

.a2ui-datetime-input__input--disabled {
  background-color: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}
</style>
