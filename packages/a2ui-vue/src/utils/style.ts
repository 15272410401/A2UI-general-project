import type { CSSProperties } from 'vue'

/** 协议 style：CSS 对象，或 `color:red;font-size:14px` 字符串 */
export type A2uiStyle =
  | string
  | Record<string, string | number | undefined | null>
  | undefined
  | null

function kebabToCamel(key: string): string {
  return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** 将协议 style 规范为 Vue :style 可用的对象 */
export function normalizeStyle(style: A2uiStyle): CSSProperties | undefined {
  if (style == null || style === '') return undefined

  if (typeof style === 'string') {
    const result: Record<string, string> = {}
    for (const part of style.split(';')) {
      const idx = part.indexOf(':')
      if (idx < 0) continue
      const rawKey = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      if (!rawKey || !value) continue
      result[kebabToCamel(rawKey)] = value
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  if (typeof style === 'object' && !Array.isArray(style)) {
    const result: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(style)) {
      if (value == null || value === '') continue
      result[kebabToCamel(key)] = value
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  return undefined
}

/** 后面的 style 覆盖前面的同名属性 */
export function mergeStyles(
  ...parts: Array<A2uiStyle | CSSProperties | undefined | null>
): CSSProperties | undefined {
  const out: Record<string, string | number> = {}
  let has = false
  for (const part of parts) {
    if (part == null) continue
    const normalized =
      typeof part === 'string'
        ? normalizeStyle(part)
        : normalizeStyle(part as Record<string, string | number | undefined | null>)
    if (!normalized) continue
    Object.assign(out, normalized)
    has = true
  }
  return has ? out : undefined
}
