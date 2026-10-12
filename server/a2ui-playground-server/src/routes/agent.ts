import type { Context } from 'koa';
import { randomUUID } from 'crypto';
import { encodeSseEvent } from '../agui/sse';
import {
  A2UI_ACTIVITY_TYPE,
  A2UI_OPERATIONS_KEY,
  EventType,
  type AguiEvent,
  type RunAgentInput,
} from '../agui/types';
import {
  streamA2uiGeneration,
  type A2uiChatTurn,
} from '../agent/a2ui-agent';
import { extractLatestUserText } from '../agent/mock';

function writeEvent(ctx: Context, event: AguiEvent): void {
  ctx.res.write(encodeSseEvent(event));
}

/** 开启 SSE 响应头并接管底层 res 写入 */
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

function collectImages(
  body: Partial<RunAgentInput> & { images?: unknown },
): string[] {
  const found: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    if (
      value.startsWith('data:image/') ||
      value.startsWith('http://') ||
      value.startsWith('https://')
    ) {
      found.push(value);
    }
  };

  if (Array.isArray(body.images)) {
    body.images.forEach(push);
  }
  const forwarded = body.forwardedProps as { images?: unknown } | undefined;
  if (Array.isArray(forwarded?.images)) {
    forwarded.images.forEach(push);
  }
  return found.slice(0, 4);
}

function collectChatTurns(
  messages: Array<{ role?: string; content?: unknown }> | undefined,
): A2uiChatTurn[] {
  if (!Array.isArray(messages)) return [];
  const turns: A2uiChatTurn[] = [];
  for (const msg of messages) {
    if (
      (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0
    ) {
      turns.push({ role: msg.role, content: msg.content });
    }
  }
  return turns;
}

/**
 * AG-UI 兼容的 agent 端点。
 * 支持多轮：messages 历史 + currentA2uiJson；微调时增量 ACTIVITY_SNAPSHOT（replace:false）。
 */
export async function handleAgentRun(ctx: Context): Promise<void> {
  const body = (ctx.request.body ?? {}) as Partial<RunAgentInput> & {
    images?: unknown;
    currentA2uiJson?: unknown;
  };
  const threadId =
    typeof body.threadId === 'string' && body.threadId.length > 0
      ? body.threadId
      : randomUUID();
  const runId =
    typeof body.runId === 'string' && body.runId.length > 0
      ? body.runId
      : randomUUID();

  const turns = collectChatTurns(body.messages);
  const userText = extractLatestUserText(body.messages);
  const images = collectImages(body);
  const currentA2uiJson =
    typeof body.currentA2uiJson === 'string' ? body.currentA2uiJson.trim() : '';

  if (!userText.trim() && images.length === 0 && turns.length === 0) {
    ctx.status = 400;
    ctx.body = {
      error: 'MISSING_USER_MESSAGE',
      message: '请提供文字描述或至少一张图片',
    };
    return;
  }

  // 若 history 为空但有 userText，补一条 user
  const messages: A2uiChatTurn[] =
    turns.length > 0
      ? turns
      : userText.trim()
        ? [{ role: 'user', content: userText }]
        : [];

  beginSse(ctx);

  const textMessageId = randomUUID();
  const activityMessageId = `a2ui-surface-${runId}`;

  try {
    writeEvent(ctx, {
      type: EventType.RUN_STARTED,
      threadId,
      runId,
    });

    writeEvent(ctx, {
      type: EventType.STEP_STARTED,
      stepName: 'a2ui_generate',
    });

    writeEvent(ctx, {
      type: EventType.TEXT_MESSAGE_START,
      messageId: textMessageId,
      role: 'assistant',
    });

    const isIncremental = Boolean(currentA2uiJson);

    for await (const event of streamA2uiGeneration({
      messages,
      images,
      currentA2uiJson: currentA2uiJson || undefined,
    })) {
      if (event.type === 'text') {
        writeEvent(ctx, {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: textMessageId,
          delta: event.delta,
        });
        continue;
      }

      writeEvent(ctx, {
        type: EventType.ACTIVITY_SNAPSHOT,
        messageId: activityMessageId,
        activityType: A2UI_ACTIVITY_TYPE,
        content: {
          [A2UI_OPERATIONS_KEY]: event.operations,
        },
        // 微调轮次：增量信封，客户端与现有 store / JSON 拼接，不整表清空
        replace: !isIncremental,
      });
    }

    writeEvent(ctx, {
      type: EventType.TEXT_MESSAGE_END,
      messageId: textMessageId,
    });

    writeEvent(ctx, {
      type: EventType.STEP_FINISHED,
      stepName: 'a2ui_generate',
    });

    writeEvent(ctx, {
      type: EventType.RUN_FINISHED,
      threadId,
      runId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeEvent(ctx, {
      type: EventType.RUN_ERROR,
      message,
      code: 'A2UI_AGENT_ERROR',
    });
  } finally {
    ctx.res.end();
  }
}
