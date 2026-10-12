import { getStore, getRenderMap } from '../store/store';
import { buildComponentTree } from '../treebuilder';
import type { Surface, HydrateNode } from '../store/types';

/**
 * 创建表面消息接口
 * 用于创建一个新的渲染表面
 */
interface CreateSurfaceMessage {
  version: 'v0.9';
  createSurface: {
    surfaceId: string;
    catalogId: string;
    sendDataModel?: boolean;
  };
}

/**
 * 更新组件消息接口
 * 用于更新表面上的组件列表
 */
interface UpdateComponentsMessage {
  version: 'v0.9';
  updateComponents: {
    surfaceId: string;
    components: Array<{
      id: string;
      component: string;
      [key: string]: unknown;
    }>;
  };
}

/**
 * 更新数据模型消息接口
 */
interface UpdateDataModelMessage {
  version: 'v0.9';
  updateDataModel: {
    surfaceId: string;
    path?: string;
    value?: unknown;
  };
}

/**
 * 删除表面消息接口
 * 用于删除指定的渲染表面
 */
interface DeleteSurfaceMessage {
  version: 'v0.9';
  deleteSurface: {
    surfaceId: string;
  };
}

/**
 * A2UI 消息联合类型
 * 包含所有支持的消息类型
 */
type A2uiMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage;

/**
 * 解析消息入口函数
 * 根据消息类型分发到对应的处理函数
 * @param message 待解析的消息对象
 */
export function parseMessage(message: unknown): void {
  const store = getStore();
  const state = store.getState();

  if (typeof message !== 'object' || message === null) {
    state.setParseError('Invalid message format: message must be an object');
    return;
  }

  const msg = message as Record<string, unknown>;

  if ('createSurface' in msg) {
    parseCreateSurface(message as CreateSurfaceMessage);
  } else if ('updateComponents' in msg) {
    parseUpdateComponents(message as UpdateComponentsMessage);
  } else if ('updateDataModel' in msg) {
    parseUpdateDataModel(message as UpdateDataModelMessage);
  } else if ('deleteSurface' in msg) {
    parseDeleteSurface(message as DeleteSurfaceMessage);
  } else {
    state.setParseError('Invalid message format: unknown message type');
  }
}

/**
 * 解析创建表面消息
 * 创建新的渲染表面并添加到状态中
 * @param message 创建表面消息
 */
function parseCreateSurface(message: CreateSurfaceMessage): void {
  const store = getStore();
  const state = store.getState();
  const { surfaceId, sendDataModel } = message.createSurface;

  const surface: Surface = {
    surfaceId,
    beginrender: false,
    rootNode: null,
    sendDataModel: sendDataModel === true,
  };

  state.addSurface(surface);
  state.setDataModel(surfaceId, {});
}

/**
 * 解析更新组件消息
 * 更新表面上的组件列表，构建组件树
 * @param message 更新组件消息
 */
function parseUpdateComponents(message: UpdateComponentsMessage): void {
  const store = getStore();
  const state = store.getState();
  const renderMap = getRenderMap();
  const { surfaceId, components } = message.updateComponents;

  const surface = state.getSurface(surfaceId);
  if (!surface) {
    state.setParseError('Surface not found: ' + surfaceId);
    return;
  }

  let rootNode: HydrateNode | null = null;

  const unregisteredComponents: string[] = [];

  for (const component of components) {
    const { id, component: componentType, ...rest } = component;

    const renderComponent = renderMap?.[componentType];

    if (!renderComponent) {
      unregisteredComponents.push(componentType);
    }

    const { childIds, props } = normalizeComponentChildren(componentType, rest);

    const existing = state.getHydrateNode(id);

    const hydrateNode: HydrateNode = {
      componentId: id,
      _vnode: {
        tag: componentType,
        props,
        children: childIds,
        component: renderComponent,
      },
      ownerSurfaceId: surfaceId,
      protocal: componentType,
      hasMounted: existing?.hasMounted ?? false,
    };

    state.addHydrateNode(hydrateNode);

    if (id === 'root') {
      rootNode = hydrateNode;
    }
  }

  if (unregisteredComponents.length > 0) {
    state.setRenderError(`以下组件未注册渲染器: ${unregisteredComponents.join(', ')}`);
  }

  if (rootNode) {
    state.updateSurface(surfaceId, { rootNode });
  }

  const tree = buildComponentTree(surfaceId);
  state.updateComponentTree(surfaceId, tree);
}

/**
 * 解析 updateDataModel：有 value 则 upsert，无 value 则删除 path
 */
function parseUpdateDataModel(message: UpdateDataModelMessage): void {
  const store = getStore();
  const state = store.getState();
  const { surfaceId, path, value } = message.updateDataModel;

  const surface = state.getSurface(surfaceId);
  if (!surface) {
    state.setParseError('Surface not found: ' + surfaceId);
    return;
  }

  if ('value' in message.updateDataModel) {
    state.updateDataModelPath(surfaceId, path, value);
  } else {
    state.removeDataModelPath(surfaceId, path);
  }
  // 数据变更不重建树：渲染层直接从 store.dataModelMap 解析
}

/**
 * 将协议中的 children / child / trigger+content / tabs[].child 归一为 children ID 列表
 * @param componentType 组件类型名
 * @param raw 除去 id、component 后的原始字段
 */
export function normalizeComponentChildren(
  componentType: string,
  raw: Record<string, unknown>,
): { childIds: string[]; props: Record<string, unknown> } {
  const {
    children,
    child,
    trigger,
    content,
    tabs,
    ...rest
  } = raw;

  if (Array.isArray(children)) {
    const childIds = children.filter((id): id is string => typeof id === 'string');
    const props: Record<string, unknown> = { ...rest };
    if (tabs !== undefined) {
      props.tabs = tabs;
    }
    return { childIds, props };
  }

  if (componentType === 'Modal') {
    const childIds: string[] = [];
    if (typeof trigger === 'string') childIds.push(trigger);
    if (typeof content === 'string') childIds.push(content);
    return { childIds, props: { ...rest } };
  }

  if (componentType === 'Tabs' && Array.isArray(tabs)) {
    const childIds = tabs
      .map((tab) => {
        if (tab && typeof tab === 'object' && typeof (tab as { child?: unknown }).child === 'string') {
          return (tab as { child: string }).child;
        }
        return null;
      })
      .filter((id): id is string => id !== null);
    return { childIds, props: { ...rest, tabs } };
  }

  if (typeof child === 'string') {
    return { childIds: [child], props: { ...rest } };
  }

  const props: Record<string, unknown> = { ...rest };
  if (tabs !== undefined) {
    props.tabs = tabs;
  }
  return { childIds: [], props };
}

/**
 * 解析删除表面消息
 * 删除指定的渲染表面及其所有关联的组件节点
 * @param message 删除表面消息
 */
function parseDeleteSurface(message: DeleteSurfaceMessage): void {
  const store = getStore();
  const state = store.getState();
  const { surfaceId } = message.deleteSurface;

  const surface = state.getSurface(surfaceId);
  if (!surface) {
    return;
  }

  const allHydrateNodes = Object.values(state.hydrateNodeMap);
  for (const node of allHydrateNodes) {
    if (node.ownerSurfaceId === surfaceId) {
      state.deleteHydrateNode(node.componentId);
    }
  }

  state.deleteSurface(surfaceId);
}

/**
 * 表单写回：只更新 store 中的 DataModel，渲染时再从 store 读数
 */
export function writeDataModelValue(
  surfaceId: string,
  path: string,
  value: unknown,
): void {
  const store = getStore();
  const state = store.getState();
  if (!state.getSurface(surfaceId)) {
    state.setParseError('Surface not found: ' + surfaceId);
    return;
  }
  state.updateDataModelPath(surfaceId, path, value);
}

export {
  handleClientAction,
  type ClientAction,
  type ClientActionResult,
} from './action';
