import { createStore } from 'zustand/vanilla';
import type { Surface, HydrateNode, ErrorInfo, A2uiStore, A2uiStoreState, RenderMap, ComponentTreeNode } from './types';
import { ErrorType } from './types';
import { setByPointer, removeByPointer } from '../datamodel';

/**
 * 创建初始状态
 * @param renderMap 可选的渲染映射表，用于初始化时设置组件渲染器
 * @returns 初始状态对象
 */
const createInitialState = (renderMap?: RenderMap): A2uiStoreState => ({
  surfaceMap: {},
  hydrateNodeMap: {},
  componentTreeMap: {},
  dataModelMap: {},
  errorInfo: null,
  renderMap: renderMap || null,
});

/**
 * 状态管理API类型
 * 由 createA2uiStore 函数返回的 Zustand store 实例类型
 */
export type A2uiStoreApi = ReturnType<typeof createA2uiStore>;

/**
 * 全局状态管理单例实例
 */
let storeInstance: A2uiStoreApi | null = null;

/**
 * 初始化状态管理
 * 如果实例尚未创建，则创建新实例；否则更新渲染映射表
 * @param renderMap 可选的渲染映射表
 * @returns 状态管理实例
 */
export function init(renderMap?: RenderMap) {
  if (!storeInstance) {
    storeInstance = createA2uiStore(renderMap);
  } else if (renderMap) {
    storeInstance.getState().setRenderMap(renderMap);
  }
  return storeInstance;
}

/**
 * 获取全局状态管理实例
 * @throws Error 如果尚未调用 init() 初始化
 * @returns 状态管理实例
 */
export function getStore() {
  if (!storeInstance) {
    throw new Error('A2uiStore has not been initialized. Call init() first.');
  }
  return storeInstance;
}

/**
 * 获取渲染映射表
 * @returns 渲染映射表或 null
 */
export function getRenderMap() {
  return getStore().getState().getRenderMap();
}

/**
 * 重置全局状态管理实例
 * 将单例实例置空，下次调用 init() 时会重新创建
 */
export function reset() {
  storeInstance = null;
}

/**
 * 创建状态管理实例
 * 使用 Zustand 创建包含状态和操作方法的 store
 * @param renderMap 可选的渲染映射表
 * @returns Zustand store 实例
 */
export function createA2uiStore(renderMap?: RenderMap) {
  return createStore<A2uiStore>((set, get) => ({
    ...createInitialState(renderMap),

    /**
     * 添加渲染表面
     * @param surface 表面对象
     */
    addSurface: (surface: Surface) => {
      set((state) => ({
        surfaceMap: {
          ...state.surfaceMap,
          [surface.surfaceId]: surface,
        },
      }));
    },

    /**
     * 获取渲染表面
     * @param surfaceId 表面ID
     * @returns 表面对象或 null
     */
    getSurface: (surfaceId: string) => {
      return get().surfaceMap[surfaceId] || null;
    },

    /**
     * 更新渲染表面
     * @param surfaceId 表面ID
     * @param updates 更新内容
     */
    updateSurface: (surfaceId: string, updates: Partial<Surface>) => {
      set((state) => ({
        surfaceMap: {
          ...state.surfaceMap,
          [surfaceId]: {
            ...state.surfaceMap[surfaceId],
            ...updates,
          },
        },
      }));
    },

    /**
     * 删除渲染表面
     * @param surfaceId 表面ID
     */
    deleteSurface: (surfaceId: string) => {
      set((state) => {
        const newSurfaceMap = { ...state.surfaceMap };
        delete newSurfaceMap[surfaceId];
        const newDataModelMap = { ...state.dataModelMap };
        delete newDataModelMap[surfaceId];
        const newComponentTreeMap = { ...state.componentTreeMap };
        delete newComponentTreeMap[surfaceId];
        return {
          surfaceMap: newSurfaceMap,
          dataModelMap: newDataModelMap,
          componentTreeMap: newComponentTreeMap,
        };
      });
    },

    /**
     * 清空所有渲染表面
     */
    clearSurfaces: () => {
      set({ surfaceMap: {}, dataModelMap: {}, componentTreeMap: {} });
    },

    /**
     * 添加组件节点
     * @param node 组件节点对象
     */
    addHydrateNode: (node: HydrateNode) => {
      set((state) => ({
        hydrateNodeMap: {
          ...state.hydrateNodeMap,
          [node.componentId]: node,
        },
      }));
    },

    /**
     * 获取组件节点
     * @param componentId 组件ID
     * @returns 组件节点对象或 null
     */
    getHydrateNode: (componentId: string) => {
      return get().hydrateNodeMap[componentId] || null;
    },

    /**
     * 更新组件节点
     * @param componentId 组件ID
     * @param updates 更新内容
     */
    updateHydrateNode: (componentId: string, updates: Partial<HydrateNode>) => {
      set((state) => ({
        hydrateNodeMap: {
          ...state.hydrateNodeMap,
          [componentId]: {
            ...state.hydrateNodeMap[componentId],
            ...updates,
          },
        },
      }));
    },

    /**
     * 删除组件节点
     * @param componentId 组件ID
     */
    deleteHydrateNode: (componentId: string) => {
      set((state) => {
        const newHydrateNodeMap = { ...state.hydrateNodeMap };
        delete newHydrateNodeMap[componentId];
        return { hydrateNodeMap: newHydrateNodeMap };
      });
    },

    /**
     * 清空所有组件节点
     */
    clearHydrateNodes: () => {
      set({ hydrateNodeMap: {} });
    },

    /**
     * 设置错误信息
     * @param error 错误信息对象
     */
    setError: (error: ErrorInfo) => {
      set({ errorInfo: error });
    },

    /**
     * 清除错误信息
     */
    clearError: () => {
      set({ errorInfo: null });
    },

    /**
     * 设置解析错误
     * @param content 错误内容
     */
    setParseError: (content: string) => {
      set({ errorInfo: { type: ErrorType.PARE_ERROR, content } });
    },

    /**
     * 设置渲染错误
     * @param content 错误内容
     */
    setRenderError: (content: string) => {
      set({ errorInfo: { type: ErrorType.RENDER_ERROR, content } });
    },

    /**
     * 获取渲染映射表
     * @returns 渲染映射表或 null
     */
    getRenderMap: () => {
      return get().renderMap;
    },

    /**
     * 设置渲染映射表
     * @param renderMap 渲染映射表或 null
     */
    setRenderMap: (renderMap: RenderMap | null) => {
      set({ renderMap });
    },

    /**
     * 更新组件树
     * @param surfaceId 表面ID
     * @param tree 组件树节点数组
     */
    updateComponentTree: (surfaceId: string, tree: ComponentTreeNode[]) => {
      set((state) => ({
        componentTreeMap: {
          ...state.componentTreeMap,
          [surfaceId]: tree,
        },
      }));
    },

    /**
     * 清空所有组件树
     */
    clearComponentTrees: () => {
      set({ componentTreeMap: {} });
    },

    /**
     * 删除指定 surface 的组件树
     */
    deleteComponentTree: (surfaceId: string) => {
      set((state) => {
        const newComponentTreeMap = { ...state.componentTreeMap };
        delete newComponentTreeMap[surfaceId];
        return { componentTreeMap: newComponentTreeMap };
      });
    },

    getDataModel: (surfaceId: string) => {
      return get().dataModelMap[surfaceId] ?? {};
    },

    setDataModel: (surfaceId: string, data: unknown) => {
      set((state) => ({
        dataModelMap: {
          ...state.dataModelMap,
          [surfaceId]: data ?? {},
        },
      }));
    },

    updateDataModelPath: (surfaceId: string, path: string | undefined, value: unknown) => {
      const current = get().dataModelMap[surfaceId] ?? {};
      const next = setByPointer(current, path, value);
      set((state) => ({
        dataModelMap: {
          ...state.dataModelMap,
          [surfaceId]: next,
        },
      }));
    },

    removeDataModelPath: (surfaceId: string, path: string | undefined) => {
      const current = get().dataModelMap[surfaceId] ?? {};
      const next = removeByPointer(current, path);
      set((state) => ({
        dataModelMap: {
          ...state.dataModelMap,
          [surfaceId]: next,
        },
      }));
    },

    clearDataModel: (surfaceId: string) => {
      set((state) => {
        const newDataModelMap = { ...state.dataModelMap };
        delete newDataModelMap[surfaceId];
        return { dataModelMap: newDataModelMap };
      });
    },

    clearDataModels: () => {
      set({ dataModelMap: {} });
    },
  }));
}