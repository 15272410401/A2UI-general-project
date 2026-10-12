<template>
  <img :src="src" :alt="alt" :class="imageClass" :style="imageStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { mergeStyles, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  width?: string | number
  height?: string | number
  borderRadius?: string
  style?: A2uiStyle
}>(), {
  alt: '',
  width: '100%',
  height: 'auto',
  borderRadius: '0'
})

const imageClass = computed(() => 'a2ui-image')

const imageStyle = computed(() => mergeStyles({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  borderRadius: props.borderRadius,
  objectFit: 'cover'
}, props.style))
</script>

<style scoped>
.a2ui-image {
  display: block;
  max-width: 100%;
}
</style>