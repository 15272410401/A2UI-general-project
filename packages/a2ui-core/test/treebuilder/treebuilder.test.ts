/// <reference types="mocha" />
/// <reference types="chai" />

import { expect } from 'chai';
import { init, getStore, reset } from '../../src/store/store';
import { parseMessage } from '../../src/parser';

describe('A2uiTreeBuilder', () => {
  beforeEach(() => {
    reset();
    init();
    const store = getStore();
    store.getState().clearSurfaces();
    store.getState().clearHydrateNodes();
    store.getState().clearError();
  });

  describe('buildComponentTree', () => {
    it('应构建简单的单层组件树', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'simple-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'simple-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'Hello World',
              variant: 'body'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['simple-surface'];

      expect(trees).to.be.an('array').with.lengthOf(1);
      expect(trees[0].componentId).to.equal('root');
      expect(trees[0].tag).to.equal('Text');
      expect(trees[0].children).to.be.an('array').with.lengthOf(0);
    });

    it('应构建两层嵌套的组件树', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'nested-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'nested-surface',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['child1']
            },
            {
              id: 'child1',
              component: 'Text',
              text: 'Child Text',
              variant: 'body'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['nested-surface'];

      expect(trees).to.be.an('array').with.lengthOf(1);
      expect(trees[0].componentId).to.equal('root');
      expect(trees[0].tag).to.equal('Column');
      expect(trees[0].children).to.be.an('array').with.lengthOf(1);
      expect(trees[0].children[0].componentId).to.equal('child1');
      expect(trees[0].children[0].tag).to.equal('Text');
    });

    it('应构建三层嵌套的组件树', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'deep-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'deep-surface',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['row1']
            },
            {
              id: 'row1',
              component: 'Row',
              children: ['child1']
            },
            {
              id: 'child1',
              component: 'Text',
              text: 'Deep Child',
              variant: 'body'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['deep-surface'];

      expect(trees).to.be.an('array').with.lengthOf(1);
      expect(trees[0].componentId).to.equal('root');
      expect(trees[0].children).to.have.lengthOf(1);
      expect(trees[0].children[0].componentId).to.equal('row1');
      expect(trees[0].children[0].children).to.have.lengthOf(1);
      expect(trees[0].children[0].children[0].componentId).to.equal('child1');
    });

    it('应处理多个子组件的情况', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'multi-child-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'multi-child-surface',
          components: [
            {
              id: 'root',
              component: 'Row',
              children: ['child1', 'child2', 'child3']
            },
            {
              id: 'child1',
              component: 'Text',
              text: 'Child 1',
              variant: 'body'
            },
            {
              id: 'child2',
              component: 'Text',
              text: 'Child 2',
              variant: 'body'
            },
            {
              id: 'child3',
              component: 'Text',
              text: 'Child 3',
              variant: 'body'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['multi-child-surface'];

      expect(trees).to.be.an('array').with.lengthOf(1);
      expect(trees[0].children).to.have.lengthOf(3);
      expect(trees[0].children[0].componentId).to.equal('child1');
      expect(trees[0].children[1].componentId).to.equal('child2');
      expect(trees[0].children[2].componentId).to.equal('child3');
    });

    it('应处理多个根组件的情况', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'multi-root-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'multi-root-surface',
          components: [
            {
              id: 'root1',
              component: 'Text',
              text: 'Root 1',
              variant: 'body'
            },
            {
              id: 'root2',
              component: 'Text',
              text: 'Root 2',
              variant: 'body'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['multi-root-surface'];

      expect(trees).to.be.an('array').with.lengthOf(2);
      expect(trees[0].componentId).to.equal('root1');
      expect(trees[1].componentId).to.equal('root2');
    });

    it('应处理不存在的 surface 返回空数组', () => {
      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['non-existent-surface'];

      expect(trees).to.be.undefined;
    });

    it('应正确传递组件属性', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'props-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'props-surface',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: 'Test Text',
              variant: 'h2'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['props-surface'];

      expect(trees[0].props).to.deep.equal({ text: 'Test Text', variant: 'h2' });
    });

    it('应处理复杂的多层级布局结构', () => {
      const createSurfaceMessage = {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'complex-surface',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      };

      const updateComponentsMessage = {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'complex-surface',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['header', 'content', 'footer']
            },
            {
              id: 'header',
              component: 'Row',
              children: ['title', 'subtitle']
            },
            {
              id: 'title',
              component: 'Text',
              text: 'Main Title',
              variant: 'h1'
            },
            {
              id: 'subtitle',
              component: 'Text',
              text: 'Subtitle',
              variant: 'body'
            },
            {
              id: 'content',
              component: 'Column',
              children: ['card1', 'card2']
            },
            {
              id: 'card1',
              component: 'Text',
              text: 'Card 1 Content',
              variant: 'body'
            },
            {
              id: 'card2',
              component: 'Text',
              text: 'Card 2 Content',
              variant: 'body'
            },
            {
              id: 'footer',
              component: 'Text',
              text: 'Footer',
              variant: 'caption'
            }
          ]
        }
      };

      parseMessage(createSurfaceMessage);
      parseMessage(updateComponentsMessage);

      const store = getStore();
      const componentTreeMap = store.getState().componentTreeMap;
      const trees = componentTreeMap['complex-surface'];

      expect(trees).to.have.lengthOf(1);
      expect(trees[0].componentId).to.equal('root');
      expect(trees[0].children).to.have.lengthOf(3);
      expect(trees[0].children[0].componentId).to.equal('header');
      expect(trees[0].children[0].children).to.have.lengthOf(2);
      expect(trees[0].children[0].children[0].componentId).to.equal('title');
      expect(trees[0].children[0].children[1].componentId).to.equal('subtitle');
      expect(trees[0].children[1].componentId).to.equal('content');
      expect(trees[0].children[1].children).to.have.lengthOf(2);
      expect(trees[0].children[2].componentId).to.equal('footer');
    });
  });
});