import dotenv from 'dotenv';
import path from 'path';

const envDir = path.resolve(__dirname, '..');
// 优先读 .env；没有时回退到已填写的 .env.example
dotenv.config({ path: path.join(envDir, '.env') });
dotenv.config({ path: path.join(envDir, '.env.example') });

/** 服务运行配置 */
export const config = {
  port: Number(process.env.PORT) || 3001,
  /** mock 流式输出每条操作间隔（毫秒） */
  mockChunkDelayMs: Number(process.env.A2UI_MOCK_CHUNK_DELAY_MS) || 80,
  /** OpenAI 兼容接口（当前 .env.example 为 DeepSeek） */
  llmApiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  llmBaseUrl:
    process.env.DEEPSEEK_API_BASE ||
    process.env.OPENAI_BASE_URL ||
    'https://api.deepseek.com',
  llmModel:
    process.env.DEEPSEEK_API_MODEL ||
    process.env.OPENAI_MODEL ||
    'deepseek-chat',
};
