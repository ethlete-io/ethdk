/** FNV-1a over UTF-16 code units, as an unsigned 32-bit integer. Not a security hash. */
export const fnv1aHash = (text: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};
