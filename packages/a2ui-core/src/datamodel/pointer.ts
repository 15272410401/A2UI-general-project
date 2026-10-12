/**
 * JSON Pointer (RFC 6901) helpers for A2UI DataModel.
 * Paths like `/user/name`; empty string or `/` means the whole document.
 */

function decodePointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Split a JSON Pointer into path segments.
 */
export function parsePointer(path: string | undefined | null): string[] {
  if (path === undefined || path === null || path === '' || path === '/') {
    return [];
  }
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  if (normalized.length === 0) {
    return [];
  }
  return normalized.split('/').map(decodePointerToken);
}

/**
 * Get a value from a data model by JSON Pointer.
 */
export function getByPointer(root: unknown, path?: string | null): unknown {
  const segments = parsePointer(path);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }
  return current;
}

/**
 * Deep-clone a JSON-compatible value.
 */
function cloneJson<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Whether the next path segment looks like an array index.
 */
function looksLikeArrayIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

/**
 * Set a value at a JSON Pointer. Auto-vivifies intermediate objects/arrays.
 * Returns a new root (does not mutate the original).
 */
export function setByPointer(root: unknown, path: string | undefined | null, value: unknown): unknown {
  const segments = parsePointer(path);
  if (segments.length === 0) {
    return cloneJson(value);
  }
  return setByPointerImmutable(root, segments, value);
}

function setByPointerImmutable(
  root: unknown,
  segments: string[],
  value: unknown,
): unknown {
  const [head, ...rest] = segments;

  if (rest.length === 0) {
    if (Array.isArray(root)) {
      const index = Number(head);
      if (Number.isNaN(index) || index < 0) {
        return root;
      }
      const copy = [...root];
      while (copy.length <= index) {
        copy.push(null);
      }
      copy[index] = cloneJson(value);
      return copy;
    }
    const base = isPlainObject(root) ? { ...root } : {};
    base[head] = cloneJson(value);
    return base;
  }

  if (Array.isArray(root)) {
    const index = Number(head);
    if (Number.isNaN(index) || index < 0) {
      return root;
    }
    const copy = [...root];
    while (copy.length <= index) {
      copy.push(null);
    }
    const child = copy[index];
    const nextChild =
      child === null || child === undefined
        ? looksLikeArrayIndex(rest[0])
          ? []
          : {}
        : child;
    copy[index] = setByPointerImmutable(nextChild, rest, value);
    return copy;
  }

  const base = isPlainObject(root) ? { ...root } : {};
  const child = base[head];
  let nextChild: unknown;
  if (child === null || child === undefined || typeof child !== 'object') {
    nextChild = looksLikeArrayIndex(rest[0]) ? [] : {};
  } else {
    nextChild = child;
  }
  base[head] = setByPointerImmutable(nextChild, rest, value);
  return base;
}

/**
 * Remove a value at a JSON Pointer. Returns a new root.
 * Removing `/` or empty path yields `{}`.
 */
export function removeByPointer(root: unknown, path: string | undefined | null): unknown {
  const segments = parsePointer(path);
  if (segments.length === 0) {
    return {};
  }
  return removeByPointerImmutable(root, segments);
}

function removeByPointerImmutable(root: unknown, segments: string[]): unknown {
  if (segments.length === 0) {
    return {};
  }
  if (root === null || typeof root !== 'object') {
    return root;
  }

  const [head, ...rest] = segments;
  if (rest.length === 0) {
    if (Array.isArray(root)) {
      const index = Number(head);
      if (Number.isNaN(index)) return root;
      return root.filter((_, i) => i !== index);
    }
    const copy = { ...(root as Record<string, unknown>) };
    delete copy[head];
    return copy;
  }

  if (Array.isArray(root)) {
    const index = Number(head);
    if (Number.isNaN(index) || index < 0 || index >= root.length) {
      return root;
    }
    const copy = [...root];
    copy[index] = removeByPointerImmutable(root[index], rest);
    return copy;
  }

  const obj = root as Record<string, unknown>;
  if (!(head in obj)) {
    return root;
  }
  return {
    ...obj,
    [head]: removeByPointerImmutable(obj[head], rest),
  };
}
