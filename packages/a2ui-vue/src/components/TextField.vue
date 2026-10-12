<template>
  <div :class="wrapperClass" :style="rootStyle">
    <label v-if="label" :class="labelClass">{{ label }}</label>
    <input
      :type="inputType"
      :value="value"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="inputClass"
      @input="handleInput"
    />
    <span v-if="error" :class="errorClass">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  value?: string
  label?: string
  placeholder?: string
  type?: 'text' | 'password' | 'email' | 'number'
  disabled?: boolean
  error?: string
  style?: A2uiStyle
}>(), {
  value: '',
  type: 'text',
  placeholder: '',
  disabled: false
})

const emit = defineEmits<{
  'update:value': [value: string]
}>()

const wrapperClass = computed(() => 'a2ui-text-field')
const rootStyle = computed(() => normalizeStyle(props.style))

const labelClass = computed(() => 'a2ui-text-field__label')

const inputClass = computed(() => [
  'a2ui-text-field__input',
  { 'a2ui-text-field__input--disabled': props.disabled }
])

const errorClass = computed(() => 'a2ui-text-field__error')

const inputType = computed(() => props.type)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:value', target.value)
}
</script>

<style scoped>
.a2ui-text-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.a2ui-text-field__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.a2ui-text-field__input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.a2ui-text-field__input:focus {
  outline: none;
  border-color: #42b983;
}

.a2ui-text-field__input--disabled {
  background-color: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.a2ui-text-field__error {
  font-size: 12px;
  color: #ef4444;
}
</style>
