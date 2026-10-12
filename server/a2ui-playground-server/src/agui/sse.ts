import type { AguiEvent } from './types';

/**
 * 将 AG-UI 事件编码为 SSE 帧。
 * 格式：`data: {json}\n\n`
 */
export function encodeSseEvent(event: AguiEvent): string {
  const payload = {
    timestamp: Date.now(),
    ...event,
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}
