/// <reference types="mocha" />
/// <reference types="chai" />

import { expect } from 'chai';
import { createA2uiStore } from '../src/store/store';
import { Surface, HydrateNode, ErrorType } from '../src/store/types';

describe('A2uiStore', () => {
  describe('initStore', () => {
    it('should initialize store with empty state', () => {
      const store = createA2uiStore();
      const state = store.getState();

      expect(state.surfaceMap).to.be.an('object').that.is.empty;
      expect(state.hydrateNodeMap).to.be.an('object').that.is.empty;
      expect(state.errorInfo).to.be.null;
    });
  });

  describe('Surface Management', () => {
    let store: ReturnType<typeof createA2uiStore>;

    beforeEach(() => {
      store = createA2uiStore();
    });

    it('should add a surface', () => {
      const surface: Surface = {
        surfaceId: 'surface-1',
        beginrender: false,
        rootNode: null,
      };

      store.getState().addSurface(surface);
      const state = store.getState();

      expect(state.surfaceMap['surface-1']).to.deep.equal(surface);
    });

    it('should get a surface by id', () => {
      const surface: Surface = {
        surfaceId: 'surface-2',
        beginrender: true,
        rootNode: null,
      };

      store.getState().addSurface(surface);
      const result = store.getState().getSurface('surface-2');

      expect(result).to.deep.equal(surface);
    });

    it('should return null for non-existent surface', () => {
      const result = store.getState().getSurface('non-existent');

      expect(result).to.be.null;
    });

    it('should update a surface', () => {
      const surface: Surface = {
        surfaceId: 'surface-3',
        beginrender: false,
        rootNode: null,
      };

      store.getState().addSurface(surface);
      store.getState().updateSurface('surface-3', { beginrender: true });

      const updatedSurface = store.getState().getSurface('surface-3');
      expect(updatedSurface?.beginrender).to.be.true;
    });

    it('should delete a surface', () => {
      const surface: Surface = {
        surfaceId: 'surface-4',
        beginrender: false,
        rootNode: null,
      };

      store.getState().addSurface(surface);
      store.getState().deleteSurface('surface-4');

      const result = store.getState().getSurface('surface-4');
      expect(result).to.be.null;
    });

    it('should clear all surfaces', () => {
      store.getState().addSurface({ surfaceId: 's1', beginrender: false, rootNode: null });
      store.getState().addSurface({ surfaceId: 's2', beginrender: true, rootNode: null });
      store.getState().clearSurfaces();

      expect(store.getState().surfaceMap).to.be.empty;
    });
  });

  describe('HydrateNode Management', () => {
    let store: ReturnType<typeof createA2uiStore>;

    beforeEach(() => {
      store = createA2uiStore();
    });

    it('should add a hydrate node', () => {
      const node: HydrateNode = {
        componentId: 'node-1',
        _vnode: {},
        ownerSurfaceId: 'surface-1',
        protocal: 'test-protocal',
        hasMounted: false,
      };

      store.getState().addHydrateNode(node);
      const state = store.getState();

      expect(state.hydrateNodeMap['node-1']).to.deep.equal(node);
    });

    it('should get a hydrate node by id', () => {
      const node: HydrateNode = {
        componentId: 'node-2',
        _vnode: {},
        ownerSurfaceId: 'surface-2',
        protocal: 'test-protocal',
        hasMounted: false,
      };

      store.getState().addHydrateNode(node);
      const result = store.getState().getHydrateNode('node-2');

      expect(result).to.deep.equal(node);
    });

    it('should update a hydrate node', () => {
      const node: HydrateNode = {
        componentId: 'node-3',
        _vnode: {},
        ownerSurfaceId: 'surface-3',
        protocal: 'test-protocal',
        hasMounted: false,
      };

      store.getState().addHydrateNode(node);
      store.getState().updateHydrateNode('node-3', { ownerSurfaceId: 'surface-updated' });

      const updatedNode = store.getState().getHydrateNode('node-3');
      expect(updatedNode?.ownerSurfaceId).to.equal('surface-updated');
    });

    it('should delete a hydrate node', () => {
      const node: HydrateNode = {
        componentId: 'node-4',
        _vnode: {},
        ownerSurfaceId: 'surface-4',
        protocal: 'test-protocal',
        hasMounted: false,
      };

      store.getState().addHydrateNode(node);
      store.getState().deleteHydrateNode('node-4');

      const result = store.getState().getHydrateNode('node-4');
      expect(result).to.be.null;
    });
  });

  describe('Error Management', () => {
    let store: ReturnType<typeof createA2uiStore>;

    beforeEach(() => {
      store = createA2uiStore();
    });

    it('should set error info', () => {
      store.getState().setError({ type: ErrorType.PARE_ERROR, content: 'Parse error' });

      const error = store.getState().errorInfo;
      expect(error).to.deep.equal({ type: ErrorType.PARE_ERROR, content: 'Parse error' });
    });

    it('should set parse error', () => {
      store.getState().setParseError('Syntax error');

      const error = store.getState().errorInfo;
      expect(error?.type).to.equal(ErrorType.PARE_ERROR);
      expect(error?.content).to.equal('Syntax error');
    });

    it('should clear error info', () => {
      store.getState().setError({ type: ErrorType.PARE_ERROR, content: 'Error' });
      store.getState().clearError();

      expect(store.getState().errorInfo).to.be.null;
    });
  });
});
