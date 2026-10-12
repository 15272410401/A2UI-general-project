<template>
  <div :class="rowClass" :style="rootStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  justify?: 'center' | 'end' | 'spaceAround' | 'spaceBetween' | 'spaceEvenly' | 'start' | 'stretch'
  align?: 'start' | 'center' | 'end' | 'stretch'
  style?: A2uiStyle
}>(), {
  justify: 'start',
  align: 'stretch'
})

const rootStyle = computed(() => normalizeStyle(props.style))

const rowClass = computed(() => [
  'a2ui-row',
  `a2ui-row--justify-${props.justify}`,
  `a2ui-row--align-${props.align}`
])
</script>

<style scoped>
.a2ui-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 16px;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}

.a2ui-row--justify-start { justify-content: flex-start; }
.a2ui-row--justify-center { justify-content: center; }
.a2ui-row--justify-end { justify-content: flex-end; }
.a2ui-row--justify-spaceBetween { justify-content: space-between; }
.a2ui-row--justify-spaceAround { justify-content: space-around; }
.a2ui-row--justify-spaceEvenly { justify-content: space-evenly; }
.a2ui-row--justify-stretch { justify-content: stretch; }

.a2ui-row--align-start { align-items: flex-start; }
.a2ui-row--align-center { align-items: center; }
.a2ui-row--align-end { align-items: flex-end; }
.a2ui-row--align-stretch { align-items: stretch; }
</style>
