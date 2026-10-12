<template>
  <div :class="listClass" :style="rootStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  direction?: 'vertical' | 'horizontal'
  align?: 'start' | 'center' | 'end' | 'stretch'
  style?: A2uiStyle
}>(), {
  direction: 'vertical',
  align: 'stretch'
})

const rootStyle = computed(() => normalizeStyle(props.style))

const listClass = computed(() => [
  'a2ui-list',
  `a2ui-list--${props.direction}`,
  `a2ui-list--align-${props.align}`
])
</script>

<style scoped>
.a2ui-list {
  display: flex;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  list-style: none;
  margin: 0;
  padding: 0;
}

.a2ui-list--vertical {
  flex-direction: column;
}

.a2ui-list--horizontal {
  flex-direction: row;
}

.a2ui-list--align-start { align-items: flex-start; }
.a2ui-list--align-center { align-items: center; }
.a2ui-list--align-end { align-items: flex-end; }
.a2ui-list--align-stretch { align-items: stretch; }
</style>
