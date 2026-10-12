<template>
  <div :class="tabsClass" :style="rootStyle">
    <div :class="headerClass" role="tablist">
      <button
        v-for="(tab, index) in tabTitles"
        :key="index"
        type="button"
        role="tab"
        :aria-selected="index === activeIndex"
        :class="tabButtonClass(index)"
        @click="activeIndex = index"
      >
        {{ tab }}
      </button>
    </div>
    <div :class="panelClass" role="tabpanel">
      <VNodeRenderer :node="activePanel" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref, useSlots, type PropType, type VNode } from 'vue'
import { normalizeStyle, type A2uiStyle } from '../utils/style'

export interface TabItem {
  title: string
  child?: string
}

const props = defineProps<{
  tabs: TabItem[]
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

const slots = useSlots()
const activeIndex = ref(0)

const tabsClass = computed(() => 'a2ui-tabs')
const rootStyle = computed(() => normalizeStyle(props.style))
const headerClass = computed(() => 'a2ui-tabs__header')
const panelClass = computed(() => 'a2ui-tabs__panel')

const tabTitles = computed(() =>
  (props.tabs || []).map((tab) =>
    typeof tab.title === 'string' ? tab.title : String(tab.title ?? '')
  )
)

const slotChildren = computed(() => {
  const nodes = slots.default?.() ?? []
  return nodes.filter((node) => node && typeof node === 'object') as VNode[]
})

const activePanel = computed(() => slotChildren.value[activeIndex.value] ?? null)

function tabButtonClass(index: number) {
  return [
    'a2ui-tabs__tab',
    { 'a2ui-tabs__tab--active': index === activeIndex.value }
  ]
}
</script>

<style scoped>
.a2ui-tabs {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.a2ui-tabs__header {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e5e7eb;
}

.a2ui-tabs__tab {
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
}

.a2ui-tabs__tab--active {
  color: #047857;
  border-bottom-color: #42b983;
  font-weight: 600;
}

.a2ui-tabs__panel {
  min-height: 40px;
}
</style>
