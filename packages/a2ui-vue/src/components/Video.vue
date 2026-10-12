<template>
  <video :src="src" :class="videoClass" :style="videoStyle" controls>
    {{ fallbackText }}
  </video>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { mergeStyles, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  src: string
  width?: string | number
  height?: string | number
  style?: A2uiStyle
}>(), {
  width: '100%',
  height: 'auto'
})

const videoClass = computed(() => 'a2ui-video')

const videoStyle = computed(() => mergeStyles({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height
}, props.style))

const fallbackText = computed(() => '您的浏览器不支持视频播放')
</script>

<style scoped>
.a2ui-video {
  display: block;
  max-width: 100%;
  border-radius: 4px;
}
</style>