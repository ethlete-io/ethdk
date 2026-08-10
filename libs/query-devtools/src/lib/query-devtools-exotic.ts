/**
 * Values the value explorer has to read through a reader of their own, because `Object.entries` on
 * them is either `[]` or a list of private fields - so a node would claim to hold nothing while
 * holding everything. `HttpHeaders` is the case this was written for: both of its real payloads are
 * `Map`s, and `Object.entries` on a `Map` is `[]`.
 */
export type ExoticValue =
  /** Rendered as a container, from these entries instead of the object's own. */
  | { typeName: string; entries: { k: string; v: unknown }[]; display?: never }
  /** Rendered as a leaf, with this text in place of `String(value)`. */
  | { typeName: string; display: string; entries?: never };

/** Duck-typed rather than `instanceof HttpHeaders`, so a second copy of `@angular/common/http` still reads. */
export const isHeadersValue = (
  value: unknown,
): value is { keys: () => string[]; getAll: (name: string) => string[] | null } =>
  !!value &&
  typeof value === 'object' &&
  'keys' in value &&
  typeof value.keys === 'function' &&
  'getAll' in value &&
  typeof value.getAll === 'function' &&
  'lazyInit' in value;

/**
 * How to render `value` if it is one of the built-ins the explorer knows, or `null` for anything it
 * should keep treating as a plain object or array.
 */
export const exoticOf = (value: unknown): ExoticValue | null => {
  // A header provider is the case in practice; `String(fn)` would dump its whole source into the row.
  if (typeof value === 'function') return { typeName: 'fn', display: value.name || 'anonymous' };

  if (!value || typeof value !== 'object') return null;

  if (value instanceof Date) {
    return { typeName: 'Date', display: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString() };
  }

  if (typeof File !== 'undefined' && value instanceof File) {
    return {
      typeName: 'File',
      entries: [
        { k: 'name', v: value.name },
        { k: 'size', v: value.size },
        { k: 'type', v: value.type },
        { k: 'lastModified', v: new Date(value.lastModified) },
      ],
    };
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return {
      typeName: 'Blob',
      entries: [
        { k: 'size', v: value.size },
        { k: 'type', v: value.type },
      ],
    };
  }

  if (value instanceof Map) {
    return { typeName: 'Map', entries: [...value].map(([k, v]) => ({ k: String(k), v })) };
  }

  if (value instanceof Set) {
    return { typeName: 'Set', entries: [...value].map((v, i) => ({ k: String(i), v })) };
  }

  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return { typeName: 'FormData', entries: [...value].map(([k, v]) => ({ k, v })) };
  }

  if (isHeadersValue(value)) {
    return { typeName: 'HttpHeaders', entries: headerEntries(value) };
  }

  return null;
};

/**
 * The headers an `HttpHeaders` actually holds, as `name: value` pairs. A header set more than once
 * joins on `, ` the way the wire format does.
 */
export const headerEntries = (headers: { keys: () => string[]; getAll: (name: string) => string[] | null }) => {
  try {
    return headers.keys().map((name) => ({ k: name, v: headers.getAll(name)?.join(', ') ?? '' }));
  } catch {
    return [];
  }
};
