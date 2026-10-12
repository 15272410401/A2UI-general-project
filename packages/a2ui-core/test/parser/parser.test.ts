/// <reference types="mocha" />
/// <reference types="chai" />

import { expect } from 'chai';
import { init, getStore, reset } from '../../src/store/store';
import { parseMessage, writeDataModelValue, handleClientAction } from '../../src/parser';
import fs from 'fs';
import path from 'path';

const mockTextComponent = {
  name: 'Text',
  props: {
    text: { required: true }
  }
};

const mockRenderMap = {
  Text: mockTextComponent
};

describe('A2uiParser', () => {
  beforeEach(() => {
    reset();
    init();
    const store = getStore();
    store.getState().clearSurfaces();
    store.getState().clearHydrateNodes();
    store.getState().clearError();
  });

  describe('parseMessage', () => {
    it('应解析 CreateSurfaceMessage，创建 surface 节点', () => {
      const message = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'test-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      parseMessage(message);

      const store = getStore();
      const surface = store.getState().getSurface('test-surface');
      expect(surface).to.not.be.null;
      expect(surface!.surfaceId).to.equal('test-surface');
      expect(surface!.beginrender).to.be.false;
      expect(surface!.rootNode).to.be.null;
    });

    it('应解析 UpdateComponentsMessage，创建 hydrate 节点', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'test-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'test-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'Hello, A2UI!'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const surface = store.getState().getSurface('test-surface');
      expect(surface).to.not.be.null;
      expect(surface!.rootNode).to.not.be.null;
      expect(surface!.rootNode!.componentId).to.equal('root');
      expect(surface!.rootNode!.ownerSurfaceId).to.equal('test-surface');
      expect(surface!.rootNode!.protocal).to.equal('Text');

      const hydrateNode = store.getState().getHydrateNode('root');
      expect(hydrateNode).to.not.be.null;
      expect(hydrateNode!.componentId).to.equal('root');
    });

    it('应解析 DeleteSurfaceMessage，移除 surface 节点并重新生成 hydrate 节点', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'test-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'test-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'Hello, A2UI!'
            }
          ]
        }
      };

      const deleteSurfaceMessage = {
        version: 'v0.9',
        deleteSurface: {
          surfaceId: 'test-surface'
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);
      parseMessage(deleteSurfaceMessage);

      const store = getStore();
      const surface = store.getState().getSurface('test-surface');
      expect(surface).to.be.null;

      const hydrateNode = store.getState().getHydrateNode('root');
      expect(hydrateNode).to.be.null;
    });

    it('应解析 mock text-component.json 数据正确', () => {
      const mockDataPath = path.join(__dirname, '../../mock/text-component.json');
      const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf-8'));

      mockData.messages.forEach((message: unknown) => {
        parseMessage(message);
      });

      const store = getStore();
      const surface = store.getState().getSurface('test-surface');
      expect(surface).to.not.be.null;
      expect(surface!.rootNode).to.not.be.null;
      expect(surface!.rootNode!.componentId).to.equal('root');
      expect(surface!.rootNode!.protocal).to.equal('Text');

      const hydrateNode = store.getState().getHydrateNode('root');
      expect(hydrateNode).to.not.be.null;
      const vnode = hydrateNode!._vnode as Record<string, unknown>;
      expect(vnode.tag).to.equal('Text');
      expect(vnode.props).to.deep.equal({ text: 'A2UI Component Preview', variant: 'h2' });
      expect(vnode.children).to.deep.equal([]);
      expect(vnode.component).to.be.undefined;
    });

    it('应解析无效消息格式设置解析错误信息', () => {
      const invalidMessage = {
        version: 'v0.9',
        unknownType: {
          surfaceId: 'test-surface'
        }
      };

      parseMessage(invalidMessage);

      const store = getStore();
      const errorInfo = store.getState().errorInfo;
      expect(errorInfo).to.not.be.null;
      expect(errorInfo!.type).to.equal('PARE_ERROR');
    });

    it('应解析 UpdateComponentsMessage，未创建 CreateSurfaceMessage 时抛出错误信息', () => {
      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'non-existent-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'Hello'
            }
          ]
        }
      };

      parseMessage(updateComponentsMessage);

      const store = getStore();
      const errorInfo = store.getState().errorInfo;
      expect(errorInfo).to.not.be.null;
    });

    it('应解析包含多个组件的消息', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'multi-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'multi-surface',
          components: [
            {
              id: 'root',
              component: 'Row',
              children: ['text1', 'text2']
            },
            {
              id: 'text1',
              component: 'Text',
              text: 'First'
            },
            {
              id: 'text2',
              component: 'Text',
              text: 'Second'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const surface = store.getState().getSurface('multi-surface');
      expect(surface).to.not.be.null;
      expect(surface!.rootNode!.componentId).to.equal('root');

      const text1 = store.getState().getHydrateNode('text1');
      expect(text1).to.not.be.null;
      expect(text1!.protocal).to.equal('Text');

      const text2 = store.getState().getHydrateNode('text2');
      expect(text2).to.not.be.null;
      expect(text2!.protocal).to.equal('Text');
    });

    it('应在提供 renderMap 时将组件实例放入 _vnode', () => {
      init(mockRenderMap);
      const store = getStore();
      store.getState().clearSurfaces();
      store.getState().clearHydrateNodes();
      store.getState().clearError();

      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'render-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'render-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'Render Test'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const hydrateNode = store.getState().getHydrateNode('root');
      expect(hydrateNode).to.not.be.null;
      expect((hydrateNode!._vnode as Record<string, unknown>).component).to.deep.equal(mockTextComponent);
    });

    it('应在未提供 renderMap 时 _vnode 中 component 字段为 undefined', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'no-render-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'no-render-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'No Render'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const hydrateNode = store.getState().getHydrateNode('root');
      expect(hydrateNode).to.not.be.null;
      expect((hydrateNode!._vnode as Record<string, unknown>).component).to.be.undefined;
    });

    it('应在 renderMap 中不存在对应组件时 component 字段为 undefined', () => {
      init(mockRenderMap);
      const store = getStore();
      store.getState().clearSurfaces();
      store.getState().clearHydrateNodes();
      store.getState().clearError();

      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'unknown-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'unknown-surface',
          components: [
            {
              id: 'root',
              component: 'UnknownComponent',
              text: 'Unknown'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const hydrateNode = store.getState().getHydrateNode('root');
      expect(hydrateNode).to.not.be.null;
      expect((hydrateNode!._vnode as Record<string, unknown>).component).to.be.undefined;
    });

    it('应在 renderMap 中不存在对应组件时设置渲染错误', () => {
      init(mockRenderMap);
      const store = getStore();
      store.getState().clearSurfaces();
      store.getState().clearHydrateNodes();
      store.getState().clearError();

      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'error-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'error-surface',
          components: [
            {
              id: 'root',
              component: 'UnknownComponent',
              text: 'Unknown'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const errorInfo = store.getState().errorInfo;
      expect(errorInfo).to.not.be.null;
      expect(errorInfo!.type).to.equal('RENDER_ERROR');
      expect(errorInfo!.content).to.include('UnknownComponent');
    });

    it('应在所有组件都已注册时不设置渲染错误', () => {
      init(mockRenderMap);
      const store = getStore();
      store.getState().clearSurfaces();
      store.getState().clearHydrateNodes();
      store.getState().clearError();

      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'valid-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'valid-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'Valid Text'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const errorInfo = store.getState().errorInfo;
      expect(errorInfo).to.be.null;
    });

    it('应将 Card 的 child 归一为 children', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'card-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'card-surface',
          components: [
            {
              id: 'card-1',
              component: 'Card',
              child: 'inner-text'
            },
            {
              id: 'inner-text',
              component: 'Text',
              text: 'Inside Card'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const cardNode = getStore().getState().getHydrateNode('card-1');
      expect(cardNode).to.not.be.null;
      const vnode = cardNode!._vnode as { children: string[]; props: Record<string, unknown> };
      expect(vnode.children).to.deep.equal(['inner-text']);
      expect(vnode.props).to.not.have.property('child');
    });

    it('应将 Modal 的 trigger/content 归一为 children', () => {
      parseMessage({
        version: 'v0.9',
        createSurface: {
          surfaceId: 'modal-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      });
      parseMessage({
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'modal-surface',
          components: [
            {
              id: 'modal-1',
              component: 'Modal',
              trigger: 'open-btn',
              content: 'modal-body'
            }
          ]
        }
      });

      const modalNode = getStore().getState().getHydrateNode('modal-1');
      const vnode = modalNode!._vnode as { children: string[]; props: Record<string, unknown> };
      expect(vnode.children).to.deep.equal(['open-btn', 'modal-body']);
      expect(vnode.props).to.not.have.property('trigger');
      expect(vnode.props).to.not.have.property('content');
    });

    it('应将 Tabs 的 tabs[].child 归一为 children 并保留 tabs props', () => {
      parseMessage({
        version: 'v0.9',
        createSurface: {
          surfaceId: 'tabs-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      });
      parseMessage({
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'tabs-surface',
          components: [
            {
              id: 'tabs-1',
              component: 'Tabs',
              tabs: [
                { title: 'One', child: 'panel-1' },
                { title: 'Two', child: 'panel-2' }
              ]
            }
          ]
        }
      });

      const tabsNode = getStore().getState().getHydrateNode('tabs-1');
      const vnode = tabsNode!._vnode as { children: string[]; props: Record<string, unknown> };
      expect(vnode.children).to.deep.equal(['panel-1', 'panel-2']);
      expect(vnode.props.tabs).to.deep.equal([
        { title: 'One', child: 'panel-1' },
        { title: 'Two', child: 'panel-2' }
      ]);
    });

    it('应解析 updateDataModel 并解析 path 绑定到组件树', () => {
      parseMessage({
        version: 'v0.9',
        createSurface: {
          surfaceId: 'login-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      });
      parseMessage({
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'login-surface',
          components: [
            {
              id: 'username_field',
              component: 'TextField',
              label: 'Username',
              value: { path: '/username' }
            }
          ]
        }
      });
      parseMessage({
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'login-surface',
          value: { username: 'demo' }
        }
      });

      const state = getStore().getState();
      expect(state.getDataModel('login-surface')).to.deep.equal({ username: 'demo' });

      const trees = state.componentTreeMap['login-surface'];
      expect(trees).to.be.an('array').with.lengthOf(1);
      // 树中保留原始绑定，数值以 store 为准
      expect(trees[0].props.value).to.deep.equal({ path: '/username' });
      expect(trees[0].propBindings).to.deep.equal({ value: '/username' });
      expect(state.getDataModel('login-surface')).to.have.property('username', 'demo');
    });

    it('writeDataModelValue 应写回 path 到 store', () => {
      parseMessage({
        version: 'v0.9',
        createSurface: {
          surfaceId: 'write-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      });
      parseMessage({
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'write-surface',
          components: [
            {
              id: 'field',
              component: 'TextField',
              value: { path: '/name' }
            }
          ]
        }
      });
      parseMessage({
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'write-surface',
          value: { name: 'old' }
        }
      });

      writeDataModelValue('write-surface', '/name', 'new');

      const state = getStore().getState();
      expect(state.getDataModel('write-surface')).to.deep.equal({ name: 'new' });
      // 树仍是原始绑定，不缓存解析值
      expect(state.componentTreeMap['write-surface'][0].props.value).to.deep.equal({ path: '/name' });
    });

    it('handleClientAction functionCall updateDataModel 应本地写 DataModel', () => {
      parseMessage({
        version: 'v0.9',
        createSurface: {
          surfaceId: 'action-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      });
      parseMessage({
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'action-surface',
          value: { message: 'Hello' }
        }
      });

      const result = handleClientAction('action-surface', {
        functionCall: {
          call: 'updateDataModel',
          args: { path: '/message', value: 'Updated locally!' }
        }
      });

      expect(result).to.equal('local');
      expect(getStore().getState().getDataModel('action-surface')).to.deep.equal({
        message: 'Updated locally!'
      });
    });

    it('handleClientAction event 应返回 server 且不改 DataModel', () => {
      parseMessage({
        version: 'v0.9',
        createSurface: {
          surfaceId: 'event-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      });
      parseMessage({
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'event-surface',
          value: { message: 'Hello' }
        }
      });

      const result = handleClientAction('event-surface', {
        event: { name: 'submit' }
      });

      expect(result).to.equal('server');
      expect(getStore().getState().getDataModel('event-surface')).to.deep.equal({
        message: 'Hello'
      });
    });

    it('handleClientAction functionCall openUrl 应打开新标签页', () => {
      parseMessage({
        version: 'v0.9',
        createSurface: {
          surfaceId: 'open-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      });

      const opened: Array<{ url: string; target?: string }> = [];
      const previousOpen = (globalThis as { open?: unknown }).open;
      (globalThis as { open: typeof globalThis.open }).open = ((
        url?: string | URL,
        target?: string,
      ) => {
        opened.push({ url: String(url), target });
        return null;
      }) as typeof globalThis.open;

      try {
        const result = handleClientAction('open-surface', {
          functionCall: {
            call: 'openUrl',
            args: { url: 'https://a2ui.org' },
            returnType: 'void'
          }
        });

        expect(result).to.equal('local');
        expect(opened).to.deep.equal([{ url: 'https://a2ui.org', target: '_blank' }]);
      } finally {
        if (previousOpen === undefined) {
          delete (globalThis as { open?: unknown }).open;
        } else {
          (globalThis as { open: unknown }).open = previousOpen;
        }
      }
    });
  });
});
