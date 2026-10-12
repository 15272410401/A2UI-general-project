<template>
  <component :is="tagName" :class="textClass" :style="rootStyle">{{ text }}</component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = withDefaults(defineProps<{
  text: string
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body'
  style?: A2uiStyle
}>(), {
  variant: 'body'
})

const tagName = computed(() => {
  const tagMap: Record<string, string> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    caption: 'span',
    body: 'span'
  }
  return tagMap[props.variant] || 'span'
})

const textClass = computed(() => `a2ui-text--${props.variant}`)

const rootStyle = computed(() => normalizeStyle(props.style))
</script>

<style scoped>
.a2ui-text--h1 {
  font-size: 2em;
  font-weight: bold;
  margin-bottom: 0.5em;
}

.a2ui-text--h2 {
  font-size: 1.5em;
  font-weight: bold;
  margin-bottom: 0.5em;
}

.a2ui-text--h3 {
  font-size: 1.25em;
  font-weight: bold;
  margin-bottom: 0.5em;
}

.a2ui-text--h4 {
  font-size: 1em;
  font-weight: bold;
  margin-bottom: 0.5em;
}

.a2ui-text--h5 {
  font-size: 0.875em;
  font-weight: bold;
  margin-bottom: 0.5em;
}

.a2ui-text--caption {
  font-size: 0.75em;
  color: #666;
}

.a2ui-text--body {
  font-size: 1em;
}
</style>