/** "black-clover" -> "Black Clover", as the web shows names (capitalize + no dashes). */
export function displayName(name: string): string {
  return name
    .replaceAll('-', ' ')
    .replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase());
}
