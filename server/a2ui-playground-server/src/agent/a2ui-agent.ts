import type OpenAI from 'openai';
import { config } from '../config';
import { getLlmClient } from '../llm/client';
import { getA2uiSystemPrompt } from '../prompts/a2ui-system';
import {
  extractA2uiEnvelopes,
  type A2uiEnvelope,
} from './parse-jsonl';

export type A2uiChatTurn = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type A2uiUserInput = {
  /** 多轮对话（含本轮 user）；assistant 内容一般为上轮完整 A2UI JSON */
  messages: A2uiChatTurn[];
  /** 本轮附带图片（仅打在最后一条 user 上） */
  images: string[];
  /** 当前界面完整 A2UI JSON，作为微调真源 */
  currentA2uiJson?: string;
};

export type A2uiStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'operations'; operations: A2uiEnvelope[] };

function normalizeTurns(messages: A2uiChatTurn[]): A2uiChatTurn[] {
  return messages.filter(
    (msg) =>
      (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0,
  );
}

/**
 * 组装发给模型的 messages：
 * system + 历史 turns；若有 currentA2uiJson 且未作为末条 assistant，则插入到最后一条 user 之前。
 * 本轮图片挂在最后一条 user 的 multimodal content 上。
 */
function buildLlmMessages(
  input: A2uiUserInput,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const turns = normalizeTurns(input.messages);
  const currentJson = input.currentA2uiJson?.trim() ?? '';
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: getA2uiSystemPrompt() },
  ];

  if (turns.length === 0) {
    const fallback =
      '请根据上传的图片还原界面，输出符合渲染器协议的 A2UI JSON（根对象 {"messages":[...]}）。';
    if (currentJson) {
      out.push({
        role: 'assistant',
        content: currentJson,
      });
      out.push({
        role: 'user',
        content: buildUserContentWithImages(
          '请在当前界面基础上按上一轮约定继续调整，并输出完整的 {"messages":[...]}。',
          input.images,
        ),
      });
      return out;
    }
    out.push({
      role: 'user',
      content: buildUserContentWithImages(fallback, input.images),
    });
    return out;
  }

  const last = turns[turns.length - 1]!;
  const prior = turns.slice(0, -1);

  for (const turn of prior) {
    out.push({ role: turn.role, content: turn.content });
  }

  const lastAssistantIsCurrent =
    prior.length > 0 &&
    prior[prior.length - 1]!.role === 'assistant' &&
    prior[prior.length - 1]!.content.trim() === currentJson;

  if (
    currentJson &&
    last.role === 'user' &&
    !lastAssistantIsCurrent
  ) {
    // 确保模型在改写前看到结构真源
    const prev = out[out.length - 1];
    if (!(prev && prev.role === 'assistant' && prev.content === currentJson)) {
      out.push({
        role: 'assistant',
        content: currentJson,
      });
    }
  }

  if (last.role === 'user') {
    const userText = currentJson
      ? `请基于上方「当前界面」A2UI JSON 做最小必要修改：只输出增量 {"messages":[...]}（不要 createSurface，不要未改动的组件）。\n\n用户要求：${last.content}`
      : last.content;
    out.push({
      role: 'user',
      content: buildUserContentWithImages(userText, input.images),
    });
  } else {
    out.push({ role: last.role, content: last.content });
    if (input.images.length > 0) {
      out.push({
        role: 'user',
        content: buildUserContentWithImages(
          '请结合上方上下文与图片，输出完整的 A2UI JSON。',
          input.images,
        ),
      });
    }
  }

  return out;
}

function buildUserContentWithImages(
  text: string,
  images: string[],
): string | OpenAI.Chat.ChatCompletionContentPart[] {
  if (images.length === 0) return text;
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text },
  ];
  for (const url of images) {
    parts.push({
      type: 'image_url',
      image_url: { url },
    });
  }
  return parts;
}

/**
 * 调用多模态模型。文本增量原样流出，供对话区显示；
 * 同时把累计 JSON（{"messages":[...]}）渐进解析成 A2UI 信封，供预览渲染。
 */
export async function* streamA2uiGeneration(
  input: A2uiUserInput,
): AsyncGenerator<A2uiStreamEvent> {
  const llm = getLlmClient();
  const stream = await llm.chat.completions.create({
    model: config.llmModel,
    temperature: 0.2,
    stream: true,
    messages: buildLlmMessages(input),
  });

  let buffer = '';
  let lastFingerprint = '';
  let operations: A2uiEnvelope[] = [];

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (!delta) continue;
    buffer += delta;
    yield { type: 'text', delta };
    const envelopes = extractA2uiEnvelopes(buffer);
    const fingerprint = JSON.stringify(envelopes);
    if (fingerprint === lastFingerprint || envelopes.length === 0) continue;
    lastFingerprint = fingerprint;
    operations = envelopes;
    yield { type: 'operations', operations: operations.slice() };
  }

  if (operations.length === 0) {
    const snippet = buffer.replace(/\s+/g, ' ').slice(0, 280);
    throw new Error(
      snippet
        ? `模型没有返回可解析的 A2UI JSON：${snippet}`
        : '模型没有返回可解析的 A2UI JSON',
    );
  }
}
