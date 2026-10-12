<template>
  <div :class="modalClass" :style="rootStyle">
    <div :class="triggerClass" @click="open = true">
      <VNodeRenderer :node="triggerNode" />
    </div>
    <div v-if="open" :class="overlayClass" @click.self="open = false">
      <div :class="contentClass" role="dialog" aria-modal="true">
        <button type="button" :class="closeClass" @click="open = false">×</button>
        <VNodeRenderer :node="contentNode" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref, useSlots, type PropType, type VNode } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

const props = defineProps<{
  style?: A2uiStyle
}>()

const VNodeRenderer = defineComponent({
  props: {
    node: { type: Object as PropType<VNode | null>, default: null }
  },
  setup(props) {
    return () => props.node
  }
})

const open = ref(false)
const slots = useSlots()

const modalClass = computed(() => 'a2ui-modal')
const rootStyle = computed(() => normalizeStyle(props.style))
const triggerClass = computed(() => 'a2ui-modal__trigger')
const overlayClass = computed(() => 'a2ui-modal__overlay')
const contentClass = computed(() => 'a2ui-modal__content')
const closeClass = computed(() => 'a2ui-modal__close')

const slotChildren = computed(() => {
  const nodes = slots.default?.() ?? []
  return nodes.filter((node) => node && typeof node === 'object') as VNode[]
})

const triggerNode = computed(() => slotChildren.value[0] ?? null)
const contentNode = computed(() => slotChildren.value[1] ?? null)
</script>

<style scoped>
.a2ui-modal {
  display: inline-block;
}

.a2ui-modal__trigger {
  display: inline-block;
  cursor: pointer;
}

.a2ui-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.a2ui-modal__content {
  position: relative;
  min-width: 280px;
  max-width: min(560px, 100%);
  max-height: 80vh;
  overflow: auto;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.a2ui-modal__close {
  position: absolute;
  top: 8px;
  right: 10px;
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
}
</style>
