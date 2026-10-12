/**
 * 本服务使用的精简 AG-UI 事件类型。
 * @see https://docs.ag-ui.com/sdk/js/core/events
 */

export const EventType = {
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  STEP_STARTED: 'STEP_STARTED',
  STEP_FINISHED: 'STEP_FINISHED',
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  ACTIVITY_SNAPSHOT: 'ACTIVITY_SNAPSHOT',
} as const;

export type EventTypeName = (typeof EventType)[keyof typeof EventType];

export type AguiEvent = {
  type: EventTypeName | string;
  timestamp?: number;
  [key: string]: unknown;
};

export type AguiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'developer';
  content?: string;
  [key: string]: unknown;
};

/** AG-UI HTTP POST 请求体 */
export type RunAgentInput = {
  threadId: string;
  runId: string;
  parentRunId?: string;
  state?: unknown;
  messages?: AguiMessage[];
  tools?: unknown[];
  context?: unknown[];
  forwardedProps?: unknown;
};

/** A2UI 在 AG-UI 上的官方 activity 类型（ag-ui a2ui-middleware） */
export const A2UI_ACTIVITY_TYPE = 'a2ui-surface';

/** ACTIVITY_SNAPSHOT.content 中存放 A2UI server→client 操作列表的键名 */
export const A2UI_OPERATIONS_KEY = 'a2ui_operations';
