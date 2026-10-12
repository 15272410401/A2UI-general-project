import { getByPointer } from '../datamodel';

/**
 * Whether a value is a DataBinding object `{ path: string }`.
 */
export function isDataBinding(value: unknown): value is { path: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'path' in value &&
    typeof (value as { path: unknown }).path === 'string' &&
    Object.keys(value as object).length === 1
  );
}

/**
 * Resolve a Dynamic* value: literals pass through; `{ path }` is read from the data model.
 * FunctionCall objects are left unresolved in this MVP.
 */
export function resolveDynamicValue(value: unknown, dataModel: unknown): unknown {
  if (isDataBinding(value)) {
    return getByPointer(dataModel, value.path);
  }
  return value;
}

/**
 * Collect path bindings from raw props without resolving values.
 */
export function extractPropBindings(
  props: Record<string, unknown>,
): Record<string, string> {
  const propBindings: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (isDataBinding(value)) {
      propBindings[key] = value.path;
    }
  }
  return propBindings;
}

/**
 * Resolve all props from the given data model (single source of truth).
 * Also returns propBindings for write-back.
 */
export function resolveProps(
  props: Record<string, unknown>,
  dataModel: unknown,
): { props: Record<string, unknown>; propBindings: Record<string, string> } {
  const resolved: Record<string, unknown> = {};
  const propBindings = extractPropBindings(props);

  for (const [key, value] of Object.entries(props)) {
    resolved[key] = resolveDynamicValue(value, dataModel);
  }

  return { props: resolved, propBindings };
}
