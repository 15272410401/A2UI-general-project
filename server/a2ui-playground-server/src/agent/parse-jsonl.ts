const ENVELOPE_KEYS = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
] as const;

export type A2uiEnvelope = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 是否为 A2UI server→client 消息信封 */
export function isA2uiEnvelope(value: unknown): value is A2uiEnvelope {
  if (!isRecord(value)) return false;
  return ENVELOPE_KEYS.some((key) => key in value);
}

/** 从模型输出的对象 / 数组 / { messages } 中收集信封（updateComponents 拆到组件级） */
export function collectA2uiMessages(value: unknown, out: A2uiEnvelope[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectA2uiMessages(item, out);
    return;
  }
  if (!isRecord(value)) return;
  if (ENVELOPE_KEYS.some((key) => key in value)) {
    const uc = value.updateComponents;
    if (isRecord(uc) && Array.isArray(uc.components) && uc.components.length > 0) {
      const version = value.version ?? 'v0.9';
      const surfaceId = uc.surfaceId;
      let pushed = false;
      for (const component of uc.components) {
        if (!isRecord(component) || typeof component.id !== 'string') continue;
        out.push({
          version,
          updateComponents: {
            surfaceId,
            components: [component],
          },
        });
        pushed = true;
      }
      if (!pushed) out.push(value);
      return;
    }
    out.push(value);
    return;
  }
  if (Array.isArray(value.messages)) {
    collectA2uiMessages(value.messages, out);
  }
}

function skipNoise(src: string, index: number): { index: number; incomplete: boolean } {
  let i = index;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      i += 1;
      continue;
    }
    if (src.startsWith('```', i)) {
      const nl = src.indexOf('\n', i);
      if (nl < 0) return { index: i, incomplete: true };
      i = nl + 1;
      continue;
    }
    break;
  }
  return { index: i, incomplete: false };
}

/** 返回 JSON 值结束下标；-1 表示尚未收齐；-2 表示括号不匹配 */
function scanJsonEnd(src: string, start: number): number {
  const open = src[start];
  if (open !== '{' && open !== '[') return -2;
  const stack = [open];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }
    if (ch === '}' || ch === ']') {
      const expected = stack[stack.length - 1] === '{' ? '}' : ']';
      if (ch !== expected) return -2;
      stack.pop();
      if (stack.length === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * 从未闭合的数组内容中渐进抽出已完整的顶层元素。
 * contentStart 指向 `[` 之后。
 */
function extractArrayElementValues(
  src: string,
  contentStart: number,
): unknown[] {
  const values: unknown[] = [];
  let i = contentStart;

  while (i < src.length) {
    while (i < src.length && /[\s,]/.test(src[i]!)) i += 1;
    if (i >= src.length || src[i] === ']') break;
    if (src[i] !== '{' && src[i] !== '[') {
      i += 1;
      continue;
    }
    const end = scanJsonEnd(src, i);
    if (end === -1) break;
    if (end === -2) {
      i += 1;
      continue;
    }
    try {
      values.push(JSON.parse(src.slice(i, end)));
    } catch {
      // 跳过
    }
    i = end;
  }
  return values;
}

function findMessagesArrayContentStart(src: string, objectStart: number): number {
  const key = '"messages"';
  let searchFrom = objectStart + 1;
  while (searchFrom < src.length) {
    const keyIndex = src.indexOf(key, searchFrom);
    if (keyIndex < 0) return -1;
    let j = keyIndex + key.length;
    while (j < src.length && /[\s:]/.test(src[j]!)) j += 1;
    if (j < src.length && src[j] === '[') return j + 1;
    searchFrom = keyIndex + 1;
  }
  return -1;
}

/** 从片段中读取 "surfaceId":"..." */
function extractSurfaceId(src: string, from: number, to?: number): string | null {
  const limit = to ?? src.length;
  const key = '"surfaceId"';
  const idx = src.indexOf(key, from);
  if (idx < 0 || idx >= limit) return null;
  let j = idx + key.length;
  while (j < limit && /[\s:]/.test(src[j]!)) j += 1;
  if (j >= limit || src[j] !== '"') return null;
  j += 1;
  let id = '';
  while (j < limit && src[j] !== '"') {
    if (src[j] === '\\') {
      id += src[j + 1] ?? '';
      j += 2;
      continue;
    }
    id += src[j]!;
    j += 1;
  }
  return id || null;
}

/**
 * 从未闭合的 updateComponents 信封中，按已完整的 component 对象合成可消费信封。
 * 每个完整组件单独一条 updateComponents，便于流式渲染。
 */
export function extractPartialUpdateComponents(
  src: string,
  objectStart: number,
): A2uiEnvelope[] {
  if (src[objectStart] !== '{') return [];

  const ucKey = '"updateComponents"';
  const ucIdx = src.indexOf(ucKey, objectStart);
  if (ucIdx < 0) return [];

  // 确认这是 updateComponents 信封，而不是碰巧同名字段
  const headSlice = src.slice(objectStart, Math.min(src.length, objectStart + 120));
  if (!/"version"\s*:/.test(headSlice) && !headSlice.includes(ucKey)) {
    // 若 object 开头尚未出现 version，仍允许继续（流式中途）
  }

  const componentsKey = '"components"';
  const ck = src.indexOf(componentsKey, ucIdx);
  if (ck < 0) return [];

  let j = ck + componentsKey.length;
  while (j < src.length && /[\s:]/.test(src[j]!)) j += 1;
  if (j >= src.length || src[j] !== '[') return [];

  // surfaceId 通常在 components 之前；若尚未出现则无法合成
  const surfaceId =
    extractSurfaceId(src, ucIdx, ck) ?? extractSurfaceId(src, ucIdx);
  if (!surfaceId) return [];

  const components = extractArrayElementValues(src, j + 1);
  const out: A2uiEnvelope[] = [];
  for (const item of components) {
    if (!isRecord(item) || typeof item.id !== 'string') continue;
    out.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [item],
      },
    });
  }
  return out;
}

/** 从 messages 数组内容起点渐进收集信封（含未闭合 updateComponents 的组件级抽取） */
function collectFromMessagesArray(
  src: string,
  contentStart: number,
  out: A2uiEnvelope[],
): void {
  let i = contentStart;
  while (i < src.length) {
    while (i < src.length && /[\s,]/.test(src[i]!)) i += 1;
    if (i >= src.length || src[i] === ']') break;
    if (src[i] !== '{') {
      i += 1;
      continue;
    }

    const end = scanJsonEnd(src, i);
    if (end === -1) {
      // 当前信封未闭合：尝试组件级渐进抽取
      out.push(...extractPartialUpdateComponents(src, i));
      break;
    }
    if (end === -2) {
      i += 1;
      continue;
    }

    try {
      const value = JSON.parse(src.slice(i, end));
      collectA2uiMessages(value, out);
    } catch {
      // 跳过
    }
    i = end;
  }
}

/**
 * 从增量文本中抽出已经可消费的 JSON 值 / 合成信封。
 * - 完整 messages 元素立刻抽出
 * - 未闭合的 updateComponents 按已完整的 component 合成信封
 */
export function extractCompleteJsonValues(src: string): unknown[] {
  return extractA2uiEnvelopes(src);
}

/** 从模型累计输出中提取全部 A2UI 信封（按出现顺序，支持组件级渐进抽取） */
export function extractA2uiEnvelopes(src: string): A2uiEnvelope[] {
  const envelopes: A2uiEnvelope[] = [];
  const skipped = skipNoise(src, 0);
  if (skipped.incomplete) return envelopes;
  let i = skipped.index;
  if (i >= src.length) return envelopes;

  if (src[i] === '[') {
    collectFromMessagesArray(src, i + 1, envelopes);
    return envelopes;
  }

  if (src[i] === '{') {
    const messagesStart = findMessagesArrayContentStart(src, i);
    if (messagesStart >= 0) {
      collectFromMessagesArray(src, messagesStart, envelopes);
      return envelopes;
    }

    const end = scanJsonEnd(src, i);
    if (end === -1) {
      envelopes.push(...extractPartialUpdateComponents(src, i));
      return envelopes;
    }
    if (end > 0) {
      try {
        collectA2uiMessages(JSON.parse(src.slice(i, end)), envelopes);
      } catch {
        // 跳过
      }
    }
  }

  return envelopes;
}
