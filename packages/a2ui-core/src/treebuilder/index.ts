import { getStore } from '../store/store';
import { extractPropBindings } from '../binding';
import type { HydrateNode, ComponentTreeNode, RenderComponent } from '../store/types';

/**
 * 构建组件树
 * 根据表面ID从状态中获取所有组件节点，构建层级树结构。
 * props 保留协议原始值（含 {path}）；渲染时再从 store.dataModelMap 解析。
 */
export function buildComponentTree(surfaceId: string): ComponentTreeNode[] {
  const store = getStore();
  const state = store.getState();
  
  const surface = state.getSurface(surfaceId);
  if (!surface) {
    return [];
  }
  
  const hydrateNodeMap = state.hydrateNodeMap;
  const rootComponentIds = findRootComponents(hydrateNodeMap, surfaceId);
  
  return rootComponentIds.map(id => {
    const node = hydrateNodeMap[id];
    return buildTreeFromNode(node, hydrateNodeMap);
  });
}

/**
 * 重建并写回指定 surface 的组件树（结构变更时使用）
 */
export function rebuildComponentTree(surfaceId: string): ComponentTreeNode[] {
  const tree = buildComponentTree(surfaceId);
  getStore().getState().updateComponentTree(surfaceId, tree);
  return tree;
}

/**
 * 查找根组件ID列表
 */
function findRootComponents(hydrateNodeMap: Record<string, HydrateNode>, surfaceId: string): string[] {
  const allIds = Object.keys(hydrateNodeMap).filter(id => 
    hydrateNodeMap[id].ownerSurfaceId === surfaceId
  );
  
  const childIds = new Set<string>();
  
  for (const id of allIds) {
    const node = hydrateNodeMap[id];
    const vnode = node._vnode as Record<string, unknown>;
    const children = vnode.children as string[] | undefined;
    
    if (Array.isArray(children)) {
      children.forEach(childId => childIds.add(childId));
    }
  }
  
  return allIds.filter(id => !childIds.has(id));
}

/**
 * 从节点递归构建树；props 为原始协议值，不在此处读 DataModel。
 */
function buildTreeFromNode(
  node: HydrateNode,
  hydrateNodeMap: Record<string, HydrateNode>,
): ComponentTreeNode {
  const vnode = node._vnode as Record<string, unknown>;
  const childrenIds = vnode.children as string[] | undefined;
  
  const children: ComponentTreeNode[] = [];
  
  if (Array.isArray(childrenIds)) {
    for (const childId of childrenIds) {
      const childNode = hydrateNodeMap[childId];
      if (childNode) {
        children.push(buildTreeFromNode(childNode, hydrateNodeMap));
      }
    }
  }

  const rawProps = (vnode.props as Record<string, unknown>) || {};
  const propBindings = extractPropBindings(rawProps);
  
  return {
    componentId: node.componentId,
    tag: vnode.tag as string,
    props: rawProps,
    component: vnode.component as RenderComponent,
    children,
    hasMounted: node.hasMounted,
    propBindings: Object.keys(propBindings).length > 0 ? propBindings : undefined,
  };
}
