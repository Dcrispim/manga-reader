// FNV-1a (32-bit) over UTF-16 code units. Stable across runs and platforms,
// so a title name always maps to the same file name (titles can contain
// characters that are unsafe or too long for a path).
export function hashName(name: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
