<template>
  <div :class="cardClass" :style="rootStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = defineProps<{
  style?: A2uiStyle
}>()

const cardClass = computed(() => 'a2ui-card')
const rootStyle = computed(() => normalizeStyle(props.style))
</script>

<style scoped>
.a2ui-card {
  width: 100%;
  box-sizing: border-box;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
</style>
