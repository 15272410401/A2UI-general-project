1. 维护原始协议
2. surface 管理
3. 组件节点 - hydrateNodeMap
4. Error 信息

interface A2uiStore {
  surfaceMap: <record, Surface>;
  hydrateNodeMap: <record, HydrateNode>;
}

interface Surface {
  surfaceId: string;
  beginrender: boolean;
  rootNode: HydrateNode;
}

interface HydrateNode {
  componentId: string;
  _vnode: VueElement;
  ownerSurfaceId: string;
  protocal: string;
}

enum ErrorType {
  PARE_ERROR,
}

interface Error {
  type: ErrorType;
  content: string;
}

store里面还有对surfaceMap, hydrateNodeMap, errorInfo的更新、删除、查询、添加操作

为了解除对 vue 的依赖, store 通过 zustand/vanilla 实现状态管理
