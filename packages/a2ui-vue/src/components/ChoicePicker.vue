<template>
  <div :class="wrapperClass" :style="rootStyle">
    <div v-if="label" :class="labelClass">{{ label }}</div>
    <input
      v-if="filterable"
      type="search"
      :value="filterText"
      placeholder="Filter options..."
      :class="filterClass"
      @input="onFilterInput"
    />
    <div :class="optionsClass">
      <label
        v-for="option in filteredOptions"
        :key="option.value"
        :class="optionClass(option.value)"
      >
        <input
          v-if="displayStyle === 'checkbox'"
          :type="inputType"
          :name="groupName"
          :value="option.value"
          :checked="isSelected(option.value)"
          @change="toggle(option.value)"
        />
        <span>{{ option.label }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

export interface ChoiceOption {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  options: ChoiceOption[]
  value: string[]
  label?: string
  variant?: 'multipleSelection' | 'mutuallyExclusive'
  displayStyle?: 'checkbox' | 'chips'
  filterable?: boolean
  style?: A2uiStyle
}>(), {
  variant: 'mutuallyExclusive',
  displayStyle: 'checkbox',
  filterable: false,
  value: () => []
})

const emit = defineEmits<{
  'update:value': [value: string[]]
}>()

const filterText = ref('')
const groupName = `a2ui-choice-${Math.random().toString(36).slice(2, 9)}`

const wrapperClass = computed(() => 'a2ui-choice-picker')
const rootStyle = computed(() => normalizeStyle(props.style))
const labelClass = computed(() => 'a2ui-choice-picker__label')
const filterClass = computed(() => 'a2ui-choice-picker__filter')
const optionsClass = computed(() => [
  'a2ui-choice-picker__options',
  `a2ui-choice-picker__options--${props.displayStyle}`
])

const inputType = computed(() =>
  props.variant === 'multipleSelection' ? 'checkbox' : 'radio'
)

const filteredOptions = computed(() => {
  const q = filterText.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q)
  )
})

function isSelected(optionValue: string) {
  return props.value.includes(optionValue)
}

function optionClass(optionValue: string) {
  return [
    'a2ui-choice-picker__option',
    `a2ui-choice-picker__option--${props.displayStyle}`,
    { 'a2ui-choice-picker__option--selected': isSelected(optionValue) }
  ]
}

function onFilterInput(event: Event) {
  filterText.value = (event.target as HTMLInputElement).value
}

function toggle(optionValue: string) {
  if (props.variant === 'mutuallyExclusive') {
    emit('update:value', [optionValue])
    return
  }
  if (isSelected(optionValue)) {
    emit(
      'update:value',
      props.value.filter((v) => v !== optionValue)
    )
  } else {
    emit('update:value', [...props.value, optionValue])
  }
}
</script>

<style scoped>
.a2ui-choice-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.a2ui-choice-picker__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.a2ui-choice-picker__filter {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.a2ui-choice-picker__options {
  display: flex;
  gap: 8px;
}

.a2ui-choice-picker__options--checkbox {
  flex-direction: column;
}

.a2ui-choice-picker__options--chips {
  flex-direction: row;
  flex-wrap: wrap;
}

.a2ui-choice-picker__option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.a2ui-choice-picker__option--chips {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #fff;
}

.a2ui-choice-picker__option--chips.a2ui-choice-picker__option--selected {
  border-color: #42b983;
  background: #ecfdf5;
  color: #047857;
}

.a2ui-choice-picker__option--chips input {
  display: none;
}
</style>
