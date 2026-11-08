/** FNV-1a hash of a narration line; lets the app detect when a voice clip is stale. */
export function textHash(text: string): string {
  let h = 0x811c9dc5
  for (const ch of text) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
