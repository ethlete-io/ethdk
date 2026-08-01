const componentIds = /* @__PURE__ */ new Map<string, number>();

export const createComponentId = (prefix: string) => {
  const id = componentIds.get(prefix) ?? 0;
  componentIds.set(prefix, id + 1);

  return `${prefix}-${id}`;
};

let randomIdFallbackCounter = 0;

/**
 * A unique id string. Uses `crypto.randomUUID()` when available, but falls back gracefully when it is
 * not - crucially in **insecure contexts** (a plain-HTTP page served from a LAN IP, not `localhost`),
 * where `crypto.randomUUID` is `undefined`. Calling it there throws, so anything using it during e.g.
 * an overlay/menu open would break on such hosts. Prefer this over `crypto.randomUUID()` directly.
 */
export const randomId = (): string => {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  // `getRandomValues` is available even in insecure contexts - build an RFC-4122-ish v4 id from it.
  if (typeof cryptoObj?.getRandomValues === 'function') {
    const bytes = Array.from(cryptoObj.getRandomValues(new Uint8Array(16)));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = bytes.map((byte) => (byte ?? 0).toString(16).padStart(2, '0'));

    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }

  // last resort: no Web Crypto at all - a session-unique (not cryptographic) id is enough for DOM ids
  return `et-id-${(randomIdFallbackCounter++).toString(36)}-${Date.now().toString(36)}`;
};
