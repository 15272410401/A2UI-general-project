<template>
  <label :class="wrapperClass" :style="rootStyle">
    <input
      type="checkbox"
      :checked="!!value"
      :disabled="disabled"
      :class="inputClass"
      @change="handleChange"
    />
    <span :class="checkmarkClass"></span>
    <span :class="labelClass">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  value?: boolean
  label?: string
  disabled?: boolean
  style?: A2uiStyle
}>(), {
  value: false,
  disabled: false
})

const emit = defineEmits<{
  'update:value': [value: boolean]
}>()

const wrapperClass = computed(() => 'a2ui-checkbox')
const rootStyle = computed(() => normalizeStyle(props.style))

const inputClass = computed(() => 'a2ui-checkbox__input')

const checkmarkClass = computed(() => 'a2ui-checkbox__checkmark')

const labelClass = computed(() => 'a2ui-checkbox__label')

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:value', target.checked)
}
</script>

<style scoped>
.a2ui-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.a2ui-checkbox__input {
  display: none;
}

.a2ui-checkbox__checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  position: relative;
  transition: all 0.2s;
}

.a2ui-checkbox__input:checked + .a2ui-checkbox__checkmark {
  background-color: #42b983;
  border-color: #42b983;
}

.a2ui-checkbox__input:checked + .a2ui-checkbox__checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.a2ui-checkbox__input:disabled + .a2ui-checkbox__checkmark {
  opacity: 0.5;
  cursor: not-allowed;
}

.a2ui-checkbox__label {
  font-size: 14px;
  color: #374151;
}
</style>
