/// <reference types="mocha" />

/**
 * 渲染表面接口
 * 代表一个独立的渲染容器，包含表面ID、渲染状态和根节点
 */
export interface Surface {
  surfaceId: string;
  beginrender: boolean;
  rootNode: HydrateNode | null;
  /** When true, client should attach data model on outbound messages (future) */
  sendDataModel?: boolean;
}

/**
 * 组件节点接口
 * 存储组件的运行时信息，包括组件ID、虚拟节点、所属表面和协议类型
 */
export interface HydrateNode {
  componentId: string;
  _vnode: unknown;
  ownerSurfaceId: string;
  protocal: string;
  /** 是否已完成首次挂载（已触发进场动画） */
  hasMounted: boolean;
}

/**
 * 渲染组件类型
 * 用于存储框架特定的组件实现（如Vue组件）
 */
export type RenderComponent = unknown;

/**
 * 渲染映射表
 * 将组件类型名称映射到实际的渲染组件
 */
export interface RenderMap {
  [key: string]: RenderComponent;
}

/**
 * 组件树节点接口
 * props 保留协议原始值（含 {path}）；渲染时从 store.dataModelMap 解析
 */
export interface ComponentTreeNode {
  componentId: string;
  tag: string;
  /** 原始 props（可能含 DataBinding），不是已解析快照 */
  props: Record<string, unknown>;
  component: RenderComponent;
  children: ComponentTreeNode[];
  /** 是否已完成首次挂载（已触发进场动画） */
  hasMounted: boolean;
  /** path 绑定：prop 名 → JSON Pointer，供表单写回 */
  propBindings?: Record<string, string>;
}

/**
 * 错误类型常量
 * 定义系统支持的错误类别：解析错误和渲染错误
 */
export const ErrorType = {
  PARE_ERROR: 'PARE_ERROR',
  RENDER_ERROR: 'RENDER_ERROR',
} as const;

/**
 * 错误类型联合类型
 */
export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

/**
 * 错误信息接口
 * 包含错误类型和错误内容
 */
export interface ErrorInfo {
  type: ErrorType;
  content: string;
}

/**
 * 状态管理核心状态接口
 * 存储所有表面、节点、组件树和错误信息
 */
export interface A2uiStoreState {
  surfaceMap: Record<string, Surface>;
  hydrateNodeMap: Record<string, HydrateNode>;
  componentTreeMap: Record<string, ComponentTreeNode[]>;
  /** per-surface JSON data model */
  dataModelMap: Record<string, unknown>;
  errorInfo: ErrorInfo | null;
  renderMap: RenderMap | null;
}

/**
 * 状态管理接口
 * 扩展状态接口，添加操作方法
 */
export interface A2uiStore extends A2uiStoreState {
  addSurface: (surface: Surface) => void;
  getSurface: (surfaceId: string) => Surface | null;
  updateSurface: (surfaceId: string, updates: Partial<Surface>) => void;
  deleteSurface: (surfaceId: string) => void;
  clearSurfaces: () => void;

  addHydrateNode: (node: HydrateNode) => void;
  getHydrateNode: (componentId: string) => HydrateNode | null;
  updateHydrateNode: (componentId: string, updates: Partial<HydrateNode>) => void;
  deleteHydrateNode: (componentId: string) => void;
  clearHydrateNodes: () => void;

  setError: (error: ErrorInfo) => void;
  clearError: () => void;
  setParseError: (content: string) => void;
  setRenderError: (content: string) => void;

  getRenderMap: () => RenderMap | null;
  setRenderMap: (renderMap: RenderMap | null) => void;

  updateComponentTree: (surfaceId: string, tree: ComponentTreeNode[]) => void;
  clearComponentTrees: () => void;
  deleteComponentTree: (surfaceId: string) => void;

  getDataModel: (surfaceId: string) => unknown;
  setDataModel: (surfaceId: string, data: unknown) => void;
  updateDataModelPath: (surfaceId: string, path: string | undefined, value: unknown) => void;
  removeDataModelPath: (surfaceId: string, path: string | undefined) => void;
  clearDataModel: (surfaceId: string) => void;
  clearDataModels: () => void;
}