<template>
  <div :class="wrapperClass" :style="rootStyle">
    <audio :src="url" :class="audioClass" controls>
      您的浏览器不支持音频播放
    </audio>
    <p v-if="description" :class="descClass">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = defineProps<{
  url: string
  description?: string
  style?: A2uiStyle
}>()

const wrapperClass = computed(() => 'a2ui-audio-player')
const rootStyle = computed(() => normalizeStyle(props.style))
const audioClass = computed(() => 'a2ui-audio-player__audio')
const descClass = computed(() => 'a2ui-audio-player__description')
</script>

<style scoped>
.a2ui-audio-player {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.a2ui-audio-player__audio {
  width: 100%;
}

.a2ui-audio-player__description {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}
</style>
