import OpenAI from 'openai';
import { config } from '../config';

let client: OpenAI | null = null;

/** 获取 OpenAI 兼容客户端（单例） */
export function getLlmClient(): OpenAI {
  if (!config.llmApiKey) {
    throw new Error('未配置模型密钥：请在 .env 或 .env.example 中设置 DEEPSEEK_API_KEY');
  }
  if (!client) {
    client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl,
    });
  }
  return client;
}

export type ChatTurn = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

/**
 * 流式调用聊天补全，逐段产出文本。
 */
export async function* streamChatCompletion(
  messages: ChatTurn[],
): AsyncGenerator<string> {
  const llm = getLlmClient();
  const stream = await llm.chat.completions.create({
    model: config.llmModel,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}
