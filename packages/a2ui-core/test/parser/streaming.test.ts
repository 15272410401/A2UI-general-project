/// <reference types="mocha" />
/// <reference types="chai" />

import { expect } from 'chai';
import { init, getStore, reset } from '../../src/store/store';
import { StreamBuffer, parseMessageChunk } from '../../src/parser/streaming';

const surfaceA = {
  version: 'v0.9',
  createSurface: {
    surfaceId: 'main',
    catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json',
  },
};

const dataA = {
  version: 'v0.9',
  updateDataModel: {
    surfaceId: 'main',
    value: { title: 'Hello' },
  },
};

describe('StreamBuffer JSON → JSONL', () => {
  it('分片推入不完整数组时，元素闭合后立刻抽出', () => {
    const buf = new StreamBuffer();
    buf.append('[{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"x"}');
    expect(buf.extract()).to.deep.equal([]);

    buf.append('},');
    const lines = buf.extract();
    expect(lines).to.have.length(1);
    expect(JSON.parse(lines[0]!)).to.deep.include({ version: 'v0.9' });
    expect(JSON.parse(lines[0]!).createSurface.surfaceId).to.equal('main');
  });

  it('多元素连续抽出顺序正确', () => {
    const buf = new StreamBuffer();
    const payload = JSON.stringify([surfaceA, dataA]);
    buf.append(payload.slice(0, 40));
    expect(buf.extract()).to.deep.equal([]);

    buf.append(payload.slice(40));
    const lines = buf.extract();
    expect(lines).to.have.length(2);
    expect(JSON.parse(lines[0]!)).to.have.property('createSurface');
    expect(JSON.parse(lines[1]!)).to.have.property('updateDataModel');
  });

  it('尾部不完整对象留在 buffer，下一块拼上后再抽出', () => {
    const buf = new StreamBuffer();
    const full = JSON.stringify([surfaceA, dataA]);
    const cut = full.indexOf('"updateDataModel"') + 10;
    buf.append(full.slice(0, cut));
    const first = buf.extract();
    expect(first).to.have.length(1);
    expect(JSON.parse(first[0]!)).to.have.property('createSurface');

    buf.append(full.slice(cut));
    const second = buf.extract();
    expect(second).to.have.length(1);
    expect(JSON.parse(second[0]!)).to.have.property('updateDataModel');
  });

  it('容忍 markdown 代码围栏噪声', () => {
    const buf = new StreamBuffer();
    buf.append('```json\n');
    buf.append(JSON.stringify([surfaceA]));
    buf.append('\n```\n');
    const lines = buf.extract();
    expect(lines).to.have.length(1);
    expect(JSON.parse(lines[0]!)).to.have.property('createSurface');
  });

  it('parseMessageChunk 将 JSON 数组消费进 store', () => {
    reset();
    init({
      Text: { name: 'Text', props: { text: { required: true } } },
    } as never);
    const store = getStore();
    store.getState().clearSurfaces();
    store.getState().clearHydrateNodes();
    store.getState().clearError();

    const buffer = new StreamBuffer();
    const chunk1 = '[{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v0_9/basic_catalog.json"}';
    expect(parseMessageChunk(buffer, chunk1)).to.equal(0);

    const chunk2 = '}]';
    expect(parseMessageChunk(buffer, chunk2)).to.equal(1);
    expect(store.getState().surfaceMap['main']).to.exist;
  });

  it('未闭合 updateComponents 时，单个 component 闭合即可抽出 JSONL', () => {
    const buf = new StreamBuffer();
    buf.append(
      '{"messages":[{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"x"}},',
    );
    let lines = buf.extract();
    expect(lines).to.have.length(1);
    expect(JSON.parse(lines[0]!)).to.have.property('createSurface');

    buf.append(
      '{"version":"v0.9","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Column","children":["t"]}',
    );
    lines = buf.extract();
    expect(lines).to.have.length(1);
    const first = JSON.parse(lines[0]!);
    expect(first.updateComponents.components[0].id).to.equal('root');

    buf.append(',{"id":"t","component":"Text","text":"Hi"}');
    lines = buf.extract();
    expect(lines).to.have.length(1);
    expect(JSON.parse(lines[0]!).updateComponents.components[0].id).to.equal(
      't',
    );
  });

  it('完整 updateComponents 也按组件拆成最小单元 JSONL', () => {
    const buf = new StreamBuffer();
    buf.append(
      JSON.stringify({
        messages: [
          surfaceA,
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'main',
              components: [
                { id: 'root', component: 'Column', children: ['t'] },
                { id: 't', component: 'Text', text: 'Hi' },
              ],
            },
          },
        ],
      }),
    );
    const lines = buf.extract();
    expect(lines).to.have.length(3);
    expect(JSON.parse(lines[0]!)).to.have.property('createSurface');
    expect(JSON.parse(lines[1]!).updateComponents.components).to.have.length(1);
    expect(JSON.parse(lines[1]!).updateComponents.components[0].id).to.equal(
      'root',
    );
    expect(JSON.parse(lines[2]!).updateComponents.components[0].id).to.equal(
      't',
    );
  });
});
