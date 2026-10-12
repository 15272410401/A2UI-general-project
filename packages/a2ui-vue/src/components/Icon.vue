<template>
  <span :class="iconClass" :style="iconStyle">{{ iconName }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { mergeStyles, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  icon: string
  size?: 'small' | 'medium' | 'large'
  color?: string
  style?: A2uiStyle
}>(), {
  size: 'medium',
  color: '#333'
})

const iconClass = computed(() => `a2ui-icon a2ui-icon--${props.size}`)

const iconName = computed(() => props.icon)

const iconStyle = computed(() => mergeStyles({ color: props.color }, props.style))
</script>

<style scoped>
.a2ui-icon {
  font-size: 16px;
  line-height: 1;
}

.a2ui-icon--small {
  font-size: 12px;
}

.a2ui-icon--medium {
  font-size: 16px;
}

.a2ui-icon--large {
  font-size: 24px;
}
</style>