import type { Context } from 'koa';
import { randomUUID } from 'crypto';
import { encodeSseEvent } from '../agui/sse';
import { EventType, type AguiEvent } from '../agui/types';
import { streamChatCompletion, type ChatTurn } from '../llm/client';

function writeEvent(ctx: Context, event: AguiEvent): void {
  ctx.res.write(encodeSseEvent(event));
}

function beginSse(ctx: Context): void {
  ctx.respond = false;
  ctx.res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== 'object') return false;
  const item = value as { role?: unknown; content?: unknown };
  return (
    (item.role === 'user' || item.role === 'assistant' || item.role === 'system') &&
    typeof item.content === 'string' &&
    item.content.length > 0
  );
}

/**
 * 纯模型对话接口。
 * POST body: { messages: [{ role, content }] }
 * SSE：TEXT_MESSAGE_CONTENT / RUN_ERROR / RUN_FINISHED
 */
export async function handleModelChat(ctx: Context): Promise<void> {
  const body = (ctx.request.body ?? {}) as { messages?: unknown };
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages.filter(isChatTurn);

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    ctx.status = 400;
    ctx.body = {
      error: 'MISSING_USER_MESSAGE',
      message: 'messages 最后一条必须是非空的 user 消息',
    };
    return;
  }

  beginSse(ctx);
  const messageId = randomUUID();

  try {
    writeEvent(ctx, {
      type: EventType.TEXT_MESSAGE_START,
      messageId,
      role: 'assistant',
    });

    for await (const delta of streamChatCompletion(messages)) {
      writeEvent(ctx, {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId,
        delta,
      });
    }

    writeEvent(ctx, {
      type: EventType.TEXT_MESSAGE_END,
      messageId,
    });
    writeEvent(ctx, {
      type: EventType.RUN_FINISHED,
      threadId: 'model-chat',
      runId: messageId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeEvent(ctx, {
      type: EventType.RUN_ERROR,
      message,
      code: 'LLM_CHAT_ERROR',
    });
  } finally {
    ctx.res.end();
  }
}
