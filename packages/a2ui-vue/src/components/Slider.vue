<template>
  <div :class="wrapperClass" :style="rootStyle">
    <label v-if="label" :class="labelClass">{{ label }}</label>
    <div :class="controlClass">
      <input
        type="range"
        :min="min"
        :max="max"
        :value="value"
        :class="inputClass"
        @input="handleInput"
      />
      <span :class="valueClass">{{ value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  value: number
  max: number
  min?: number
  label?: string
  style?: A2uiStyle
}>(), {
  min: 0
})

const emit = defineEmits<{
  'update:value': [value: number]
}>()

const wrapperClass = computed(() => 'a2ui-slider')
const rootStyle = computed(() => normalizeStyle(props.style))
const labelClass = computed(() => 'a2ui-slider__label')
const controlClass = computed(() => 'a2ui-slider__control')
const inputClass = computed(() => 'a2ui-slider__input')
const valueClass = computed(() => 'a2ui-slider__value')

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:value', Number(target.value))
}
</script>

<style scoped>
.a2ui-slider {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.a2ui-slider__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.a2ui-slider__control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.a2ui-slider__input {
  flex: 1;
  accent-color: #42b983;
}

.a2ui-slider__value {
  min-width: 2em;
  font-size: 14px;
  color: #6b7280;
  text-align: right;
}
</style>
