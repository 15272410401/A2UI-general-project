import { parseMessage } from './index';

const ENVELOPE_KEYS = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 是否为 A2UI server→client 消息信封 */
function isA2uiEnvelope(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return ENVELOPE_KEYS.some((key) => key in value);
}

/**
 * 将单个信封拆成流式渲染最小单元 JSONL 行。
 * updateComponents 按 component 拆开，每个组件一行。
 */
function envelopeToMinimalJsonlLines(item: Record<string, unknown>): string[] {
  const version = item.version ?? 'v0.9';
  const uc = item.updateComponents;
  if (isRecord(uc) && Array.isArray(uc.components) && uc.components.length > 0) {
    const surfaceId = uc.surfaceId;
    const lines: string[] = [];
    for (const component of uc.components) {
      if (!isRecord(component) || typeof component.id !== 'string') continue;
      lines.push(
        JSON.stringify({
          version,
          updateComponents: {
            surfaceId,
            components: [component],
          },
        }),
      );
    }
    return lines.length > 0 ? lines : [JSON.stringify(item)];
  }
  return [JSON.stringify(item)];
}

/** 将信封写成 JSONL 行；数组 / {messages} 展开；updateComponents 拆到组件级 */
function envelopesToJsonlLines(value: unknown): string[] {
  const lines: string[] = [];
  const collect = (item: unknown) => {
    if (Array.isArray(item)) {
      for (const child of item) collect(child);
      return;
    }
    if (!isRecord(item)) return;
    if (isA2uiEnvelope(item)) {
      lines.push(...envelopeToMinimalJsonlLines(item));
      return;
    }
    if (Array.isArray(item.messages)) {
      collect(item.messages);
    }
  };
  collect(value);
  return lines;
}

/**
 * 跳过空白与 markdown 代码围栏起始行。
 * incomplete=true 表示围栏尚未换行，需等待更多数据。
 */
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

/**
 * 返回 JSON 值结束下标（不含越界）。
 * -1：尚未收齐；-2：括号不匹配或起始非法。
 */
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

function extractArrayElementValues(src: string, contentStart: number): unknown[] {
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
 * 从未闭合的 updateComponents 中，把已完整的 component 合成 JSONL 行。
 */
function extractPartialUpdateComponentsJsonl(
  src: string,
  objectStart: number,
): string[] {
  if (src[objectStart] !== '{') return [];
  const ucKey = '"updateComponents"';
  const ucIdx = src.indexOf(ucKey, objectStart);
  if (ucIdx < 0) return [];

  const componentsKey = '"components"';
  const ck = src.indexOf(componentsKey, ucIdx);
  if (ck < 0) return [];

  let j = ck + componentsKey.length;
  while (j < src.length && /[\s:]/.test(src[j]!)) j += 1;
  if (j >= src.length || src[j] !== '[') return [];

  const surfaceId =
    extractSurfaceId(src, ucIdx, ck) ?? extractSurfaceId(src, ucIdx);
  if (!surfaceId) return [];

  const components = extractArrayElementValues(src, j + 1);
  const lines: string[] = [];
  for (const item of components) {
    if (!isRecord(item) || typeof item.id !== 'string') continue;
    lines.push(
      JSON.stringify({
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [item],
        },
      }),
    );
  }
  return lines;
}

/**
 * 从数组内容起点渐进抽出已闭合的顶层元素，写成 JSONL 行。
 * 遇未闭合的 updateComponents 时，按已完整组件合成行（partialOffset 跳过已消费条数）。
 */
function extractArrayElements(
  src: string,
  contentStart: number,
  partialOffset: number,
): {
  lines: string[];
  nextIndex: number;
  closed: boolean;
  incomplete: boolean;
  partialTotal: number;
} {
  const lines: string[] = [];
  let i = contentStart;
  let partialTotal = 0;

  while (i < src.length) {
    while (i < src.length && /[\s,]/.test(src[i]!)) i += 1;
    if (i >= src.length) {
      return {
        lines,
        nextIndex: i,
        closed: false,
        incomplete: true,
        partialTotal,
      };
    }

    if (src[i] === ']') {
      return {
        lines,
        nextIndex: i + 1,
        closed: true,
        incomplete: false,
        partialTotal: 0,
      };
    }

    if (src[i] !== '{' && src[i] !== '[') {
      i += 1;
      continue;
    }

    const end = scanJsonEnd(src, i);
    if (end === -1) {
      const partial = extractPartialUpdateComponentsJsonl(src, i);
      partialTotal = partial.length;
      lines.push(...partial.slice(partialOffset));
      return {
        lines,
        nextIndex: i,
        closed: false,
        incomplete: true,
        partialTotal,
      };
    }
    if (end === -2) {
      i += 1;
      continue;
    }

    try {
      const value = JSON.parse(src.slice(i, end));
      lines.push(...envelopesToJsonlLines(value));
    } catch {
      // 跳过无法解析的片段
    }
    i = end;
  }

  return {
    lines,
    nextIndex: i,
    closed: false,
    incomplete: true,
    partialTotal,
  };
}

/**
 * 在对象字面量中定位 `"messages"` 数组的内容起点（`[` 之后）。
 * 找不到或尚未完整出现时返回 -1。
 */
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

/**
 * Agent JSON → JSONL 流式解析缓冲区
 *
 * Agent 推送 {"messages":[...]}（或顶层数组）。在数组 / 信封未完全闭合时，
 * 只要出现已完整的最小单元（信封，或 updateComponents.components 里的单个组件），
 * 就立刻转成 JSONL 行供 parseMessage 消费，避免整包等待空白。
 */
export class StreamBuffer {
  private buffer: string = '';
  /** 当前未闭合 updateComponents 已下发的组件级 JSONL 条数 */
  private partialComponentEmitted = 0;

  /** 追加本次推送的 JSON 片段 */
  append(data: string): void {
    this.buffer += data;
  }

  /** 清空缓冲区 */
  clear(): void {
    this.buffer = '';
    this.partialComponentEmitted = 0;
  }

  /**
   * 抽出当前可消费的 JSONL 行，并从缓冲区清除已消费前缀。
   * 不完整的尾部保留，等待下次 append。
   */
  extract(): string[] {
    const results: string[] = [];

    while (this.buffer.length > 0) {
      const skipped = skipNoise(this.buffer, 0);
      if (skipped.incomplete) break;
      if (skipped.index > 0) {
        this.buffer = this.buffer.slice(skipped.index);
      }
      if (this.buffer.length === 0) break;

      const head = this.buffer[0];

      if (head === '[') {
        const { lines, nextIndex, closed, incomplete, partialTotal } =
          extractArrayElements(this.buffer, 1, this.partialComponentEmitted);
        results.push(...lines);
        if (closed) {
          this.partialComponentEmitted = 0;
          let end = nextIndex;
          while (end < this.buffer.length && /[\s`]/.test(this.buffer[end]!)) {
            if (this.buffer.startsWith('```', end)) {
              const nl = this.buffer.indexOf('\n', end);
              end = nl < 0 ? this.buffer.length : nl + 1;
              continue;
            }
            end += 1;
          }
          this.buffer = this.buffer.slice(end);
          continue;
        }
        if (incomplete && partialTotal > 0) {
          this.partialComponentEmitted = partialTotal;
          break;
        }
        this.partialComponentEmitted = 0;
        if (lines.length > 0 || nextIndex > 1) {
          this.buffer = '[' + this.buffer.slice(nextIndex);
        }
        if (incomplete) break;
        continue;
      }

      if (head === '{') {
        const messagesStart = findMessagesArrayContentStart(this.buffer, 0);
        if (messagesStart >= 0) {
          const { lines, nextIndex, closed, incomplete, partialTotal } =
            extractArrayElements(
              this.buffer,
              messagesStart,
              this.partialComponentEmitted,
            );
          results.push(...lines);
          if (closed) {
            this.partialComponentEmitted = 0;
            const objEnd = scanJsonEnd(this.buffer, 0);
            if (objEnd === -1) {
              this.buffer =
                this.buffer.slice(0, messagesStart) +
                this.buffer.slice(nextIndex);
              break;
            }
            if (objEnd > 0) {
              this.buffer = this.buffer.slice(objEnd);
              continue;
            }
          }
          if (incomplete && partialTotal > 0) {
            this.partialComponentEmitted = partialTotal;
            // 已完整的 messages 元素仍可清除；未闭合信封留在 buffer
            if (nextIndex > messagesStart && lines.length > 0) {
              // nextIndex 停在未闭合对象起点；清除其前的完整元素
              this.buffer =
                this.buffer.slice(0, messagesStart) +
                this.buffer.slice(nextIndex);
            }
            break;
          }
          this.partialComponentEmitted = 0;
          if (lines.length > 0) {
            this.buffer =
              this.buffer.slice(0, messagesStart) + this.buffer.slice(nextIndex);
          }
          if (incomplete || !closed) break;
          continue;
        }

        const end = scanJsonEnd(this.buffer, 0);
        if (end === -1) {
          const partial = extractPartialUpdateComponentsJsonl(this.buffer, 0);
          const fresh = partial.slice(this.partialComponentEmitted);
          this.partialComponentEmitted = partial.length;
          results.push(...fresh);
          break;
        }
        if (end === -2) {
          this.buffer = this.buffer.slice(1);
          continue;
        }
        this.partialComponentEmitted = 0;
        try {
          const value = JSON.parse(this.buffer.slice(0, end));
          results.push(...envelopesToJsonlLines(value));
        } catch {
          // 丢弃坏片段
        }
        this.buffer = this.buffer.slice(end);
        continue;
      }

      this.buffer = this.buffer.slice(1);
    }

    return results;
  }
}

/**
 * 解析单次推送的 JSON 数据片段
 *
 * Agent 推送 JSON；缓冲区在最小可消费单元（信封或单个 component）就绪时
 * 转成 JSONL 行，再交给 parseMessage 消费。
 */
export function parseMessageChunk(buffer: StreamBuffer, jsonData: string): number {
  buffer.append(jsonData);
  const lines = buffer.extract();

  for (const line of lines) {
    try {
      const message = JSON.parse(line);
      parseMessage(message);
    } catch {
      console.error('[StreamBuffer] JSONL 解析失败:', line);
    }
  }

  return lines.length;
}
