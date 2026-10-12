<template>
  <div :class="columnClass" :style="rootStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  justify?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly' | 'stretch'
  align?: 'center' | 'end' | 'start' | 'stretch'
  style?: A2uiStyle
}>(), {
  justify: 'start',
  align: 'stretch'
})

const rootStyle = computed(() => normalizeStyle(props.style))

const columnClass = computed(() => [
  'a2ui-column',
  `a2ui-column--justify-${props.justify}`,
  `a2ui-column--align-${props.align}`
])
</script>

<style scoped>
.a2ui-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  min-width: 0;
}

.a2ui-column--justify-start { justify-content: flex-start; }
.a2ui-column--justify-center { justify-content: center; }
.a2ui-column--justify-end { justify-content: flex-end; }
.a2ui-column--justify-spaceBetween { justify-content: space-between; }
.a2ui-column--justify-spaceAround { justify-content: space-around; }
.a2ui-column--justify-spaceEvenly { justify-content: space-evenly; }
.a2ui-column--justify-stretch { justify-content: stretch; }

.a2ui-column--align-start { align-items: flex-start; }
.a2ui-column--align-center { align-items: center; }
.a2ui-column--align-end { align-items: flex-end; }
.a2ui-column--align-stretch { align-items: stretch; }
</style>
