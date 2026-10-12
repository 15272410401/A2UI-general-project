import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { config } from './config';
import { handleAgentRun } from './routes/agent';
import { handleModelChat } from './routes/chat';

const app = new Koa();

app.use(
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept', 'Authorization'],
  }),
);

app.use(
  bodyParser({
    enableTypes: ['json'],
    jsonLimit: '12mb',
  }),
);

// 健康检查
app.use(async (ctx, next) => {
  if (ctx.path === '/health' && ctx.method === 'GET') {
    ctx.body = {
      ok: true,
      service: 'a2ui-playground-server',
      transport: 'ag-ui/sse',
      agent: 'llm',
      llm: Boolean(config.llmApiKey),
      llmModel: config.llmModel,
    };
    return;
  }
  await next();
});

// 纯模型对话：SSE 文本流，不生成 A2UI
app.use(async (ctx, next) => {
  if (ctx.path === '/chat' && ctx.method === 'POST') {
    await handleModelChat(ctx);
    return;
  }
  await next();
});

// AG-UI Agent：RunAgentInput → SSE 事件流
app.use(async (ctx, next) => {
  if (ctx.path === '/agent' && ctx.method === 'POST') {
    await handleAgentRun(ctx);
    return;
  }
  await next();
});

app.use(async (ctx) => {
  ctx.status = 404;
  ctx.body = {
    error: 'NOT_FOUND',
    message: '请使用 POST /agent、POST /chat 或 GET /health',
  };
});

app.listen(config.port, () => {
  console.log(
    `[a2ui-playground-server] 已启动 http://localhost:${config.port}`,
  );
  console.log(`  GET  /health`);
  console.log(`  POST /agent  （A2UI JSON messages，文字/图片 → ACTIVITY_SNAPSHOT）`);
  console.log(
    `  POST /chat   （模型对话 SSE，model=${config.llmModel}，已配置密钥=${Boolean(config.llmApiKey)}）`,
  );
});
