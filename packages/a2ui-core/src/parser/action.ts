import { getStore } from '../store/store';

/**
 * 协议 Action 载荷（客户端 host 使用的子集）。
 * - event: 发往服务端（MVP 暂不发送）
 * - functionCall: 在本地执行
 */
export type ClientAction =
  | { event: { name: string; context?: Record<string, unknown> } }
  | {
      functionCall: {
        call: string;
        args?: Record<string, unknown>;
        returnType?: string;
      };
    };

export type ClientActionResult = 'local' | 'server' | 'ignored';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function openUrlInNewTab(url: string): boolean {
  const openFn = (globalThis as { open?: unknown }).open;
  if (typeof openFn !== 'function') {
    return false;
  }
  (openFn as (url: string, target?: string, features?: string) => unknown)(
    url,
    '_blank',
    'noopener,noreferrer',
  );
  return true;
}

/**
 * 处理组件交互产生的客户端 Action。
 * 本地 MVP：
 * - functionCall.call === 'updateDataModel' → 写入 DataModel
 * - functionCall.call === 'openUrl' → 在新标签页打开 URL（basic_catalog）
 */
export function handleClientAction(
  surfaceId: string,
  action: unknown,
): ClientActionResult {
  if (!isRecord(action)) {
    return 'ignored';
  }

  if ('functionCall' in action && isRecord(action.functionCall)) {
    const { call, args } = action.functionCall as {
      call?: unknown;
      args?: unknown;
    };

    if (call === 'updateDataModel' && isRecord(args)) {
      const path = args.path;
      if (typeof path !== 'string') {
        return 'ignored';
      }
      const store = getStore();
      const state = store.getState();
      if (!state.getSurface(surfaceId)) {
        state.setParseError('Surface not found: ' + surfaceId);
        return 'ignored';
      }
      state.updateDataModelPath(surfaceId, path, args.value);
      return 'local';
    }

    if (call === 'openUrl' && isRecord(args)) {
      const url = args.url;
      if (typeof url !== 'string' || url.length === 0) {
        return 'ignored';
      }
      // openUrl 不使用 surfaceId，保留参数以统一 Action API
      void surfaceId;
      if (!openUrlInNewTab(url)) {
        return 'ignored';
      }
      return 'local';
    }

    return 'ignored';
  }

  if ('event' in action && isRecord(action.event)) {
    return 'server';
  }

  return 'ignored';
}
