import fs from 'fs';
import path from 'path';

export type A2uiMessage = Record<string, unknown>;

type MockBundle = {
  messages: A2uiMessage[];
};

const MOCK_DIR = path.resolve(__dirname, '../../../../packages/a2ui-core/mock');

function loadMock(name: string): A2uiMessage[] {
  const filePath = path.join(MOCK_DIR, `${name}.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as MockBundle;
  if (!Array.isArray(parsed.messages)) {
    throw new Error(`无效的 mock 文件（缺少 messages[]）: ${filePath}`);
  }
  return parsed.messages;
}

/**
 * 根据最新用户输入挑选对应的 mock A2UI 消息列表。
 */
export function selectMockMessages(userText: string): {
  mockName: string;
  messages: A2uiMessage[];
} {
  const text = userText.toLowerCase();

  if (
    text.includes('cart') ||
    text.includes('购物车') ||
    text.includes('shopping')
  ) {
    return { mockName: 'shopping-cart', messages: loadMock('shopping-cart') };
  }
  if (text.includes('login') || text.includes('登录') || text.includes('登陆')) {
    return { mockName: 'login-form', messages: loadMock('login-form') };
  }
  if (
    text.includes('catalog') ||
    text.includes('full') ||
    text.includes('组件')
  ) {
    return { mockName: 'full-catalog', messages: loadMock('full-catalog') };
  }
  if (text.includes('column') || text.includes('布局')) {
    return { mockName: 'column-layout', messages: loadMock('column-layout') };
  }

  return { mockName: 'local-action', messages: loadMock('local-action') };
}

export function extractLatestUserText(
  messages: Array<{ role?: string; content?: unknown }> | undefined,
): string {
  if (!messages || messages.length === 0) {
    return '';
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user' && typeof msg.content === 'string') {
      return msg.content;
    }
  }
  return '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 异步生成器：逐条产出 A2UI 操作（mock 流式）。
 */
export async function* streamMockA2uiOperations(
  userText: string,
  chunkDelayMs: number,
): AsyncGenerator<{ mockName: string; operations: A2uiMessage[] }> {
  const { mockName, messages } = selectMockMessages(userText);
  const accumulated: A2uiMessage[] = [];

  for (const message of messages) {
    accumulated.push(message);
    yield { mockName, operations: [...accumulated] };
    if (chunkDelayMs > 0) {
      await sleep(chunkDelayMs);
    }
  }
}
