/// <reference types="mocha" />
/// <reference types="chai" />

import { expect } from 'chai';
import { getByPointer, setByPointer, removeByPointer } from '../../src/datamodel';
import { isDataBinding, resolveDynamicValue, resolveProps, extractPropBindings } from '../../src/binding';

describe('DataModel pointer', () => {
  it('should get nested values by JSON Pointer', () => {
    const root = { user: { name: 'Ada' }, tags: ['a', 'b'] };
    expect(getByPointer(root, '/user/name')).to.equal('Ada');
    expect(getByPointer(root, '/tags/1')).to.equal('b');
    expect(getByPointer(root, '/')).to.deep.equal(root);
    expect(getByPointer(root, undefined)).to.deep.equal(root);
  });

  it('should set values and auto-vivify parents', () => {
    const next = setByPointer({}, '/user/name', 'Ada');
    expect(next).to.deep.equal({ user: { name: 'Ada' } });
  });

  it('should set nested array item fields without wiping siblings', () => {
    const root = {
      items: [
        { name: 'A', qty: 1 },
        { name: 'B', qty: 2 },
      ],
    };
    const next = setByPointer(root, '/items/0/qty', 5);
    expect(next).to.deep.equal({
      items: [
        { name: 'A', qty: 5 },
        { name: 'B', qty: 2 },
      ],
    });
  });

  it('should auto-vivify arrays when path segment is an index', () => {
    const next = setByPointer({}, '/items/0/name', 'A');
    expect(next).to.deep.equal({ items: [{ name: 'A' }] });
  });

  it('should replace entire model when path is root', () => {
    const next = setByPointer({ a: 1 }, '/', { b: 2 });
    expect(next).to.deep.equal({ b: 2 });
  });

  it('should remove values by path', () => {
    const root = { user: { name: 'Ada', age: 30 } };
    const next = removeByPointer(root, '/user/age');
    expect(next).to.deep.equal({ user: { name: 'Ada' } });
  });

  it('should clear model when removing root', () => {
    expect(removeByPointer({ a: 1 }, '/')).to.deep.equal({});
  });
});

describe('Binding resolve', () => {
  it('should detect data bindings', () => {
    expect(isDataBinding({ path: '/x' })).to.equal(true);
    expect(isDataBinding({ path: '/x', extra: 1 })).to.equal(false);
    expect(isDataBinding('hello')).to.equal(false);
  });

  it('should resolve path bindings and keep literals', () => {
    const model = { username: 'demo' };
    expect(resolveDynamicValue({ path: '/username' }, model)).to.equal('demo');
    expect(resolveDynamicValue('literal', model)).to.equal('literal');
  });

  it('should resolve props and collect propBindings', () => {
    const model = { username: 'demo', password: 'secret' };
    const { props, propBindings } = resolveProps(
      {
        label: 'Username',
        value: { path: '/username' },
        placeholder: 'Enter',
      },
      model,
    );
    expect(props.value).to.equal('demo');
    expect(props.label).to.equal('Username');
    expect(propBindings).to.deep.equal({ value: '/username' });
  });

  it('extractPropBindings should not resolve values', () => {
    const bindings = extractPropBindings({
      value: { path: '/username' },
      label: 'Name',
    });
    expect(bindings).to.deep.equal({ value: '/username' });
  });
});
