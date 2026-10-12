<template>
  <div :class="dividerClass" :style="rootStyle" role="separator"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  axis?: 'horizontal' | 'vertical'
  style?: A2uiStyle
}>(), {
  axis: 'horizontal'
})

const rootStyle = computed(() => normalizeStyle(props.style))

const dividerClass = computed(() => [
  'a2ui-divider',
  `a2ui-divider--${props.axis}`
])
</script>

<style scoped>
.a2ui-divider {
  flex-shrink: 0;
  border: none;
  background-color: #e5e7eb;
}

.a2ui-divider--horizontal {
  width: 100%;
  height: 1px;
  margin: 8px 0;
}

.a2ui-divider--vertical {
  width: 1px;
  align-self: stretch;
  min-height: 1em;
  margin: 0 8px;
}
</style>
