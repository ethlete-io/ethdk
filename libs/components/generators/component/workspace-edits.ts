const LIB_EXPORT = /^export \* from '(\.\/lib\/[^']+)';$/;
const SIDEBAR_ENTRY = /^(\s*)\{ text: '([^']+)', link: '([^']+)' \},$/;
const ERROR_BLOCK = /\/\/ codes \d+-(\d+)/;
const CODE_RANGE_ROW = /^\| \d+ – \d+ \|.*\|$/;
const NEXT_FREE_BLOCK = /next free: \*\*\d+\*\*/;

/** Adds `export * from './lib/<domain>';` to the lib's root barrel, in alphabetical order. */
export function insertBarrelExport(content: string, domain: string): string {
  const path = `./lib/${domain}`;
  const line = `export * from '${path}';`;
  const lines = content.split('\n');

  if (lines.includes(line)) {
    return content;
  }

  const exportIndexes = lines.map((l, i) => (LIB_EXPORT.test(l) ? i : -1)).filter((i) => i !== -1);

  if (!exportIndexes.length) {
    return content;
  }

  const before = exportIndexes.find((i) => (lines[i]?.match(LIB_EXPORT)?.[1] ?? '') > path);
  const at = before ?? (exportIndexes[exportIndexes.length - 1] ?? 0) + 1;

  lines.splice(at, 0, line);

  return lines.join('\n');
}

/**
 * Adds `{ text, link }` to the named VitePress sidebar group. An alphabetical group keeps that
 * order - a stray pair out of place (a group naming a recipe page, say) still counts as
 * alphabetical - while a hand-ordered group (the forms one) gets the entry appended instead.
 */
export function insertDocsSidebarEntry(content: string, group: string, text: string, link: string): string {
  if (content.includes(`link: '${link}' }`)) {
    return content;
  }

  const lines = content.split('\n');
  const groupIndex = lines.findIndex((l) => l.trim() === `text: '${group}',`);

  if (groupIndex === -1) {
    return content;
  }

  const itemsIndex = lines.findIndex((l, i) => i > groupIndex && l.trim() === 'items: [');

  if (itemsIndex === -1) {
    return content;
  }

  const end = lines.findIndex((l, i) => i > itemsIndex && l.trim() === '],');

  if (end === -1) {
    return content;
  }

  const entries = lines
    .slice(itemsIndex + 1, end)
    .map((l, i) => ({ index: itemsIndex + 1 + i, match: l.match(SIDEBAR_ENTRY) }))
    .filter((e): e is { index: number; match: RegExpMatchArray } => e.match !== null);

  if (!entries.length) {
    return content;
  }

  const indent = entries[0]?.match[1] ?? '';
  const texts = entries.map((e) => e.match[2] ?? '');
  const alphabetical = isMostlyAlphabetical(texts);
  const at = (alphabetical ? entries.find((e) => (e.match[2] ?? '').localeCompare(text) > 0)?.index : undefined) ?? end;

  lines.splice(at, 0, `${indent}{ text: '${text}', link: '${link}' },`);

  return lines.join('\n');
}

/**
 * Claims a block in the architecture doc's error-code table: appends the row and moves the
 * "next free" pointer on, so the table stays append-only the way the doc requires.
 */
export function claimErrorCodeBlock(content: string, block: number, domain: string): string {
  const lines = content.split('\n');
  const lastRow = lines.reduce((last, line, i) => (CODE_RANGE_ROW.test(line) ? i : last), -1);

  if (lastRow === -1) {
    return content;
  }

  lines.splice(lastRow + 1, 0, `| ${block} – ${block + 99} | ${domain} |`);

  return lines.join('\n').replace(NEXT_FREE_BLOCK, `next free: **${block + 100}**`);
}

const MAX_OUT_OF_ORDER_RATIO = 0.2;

function isMostlyAlphabetical(texts: string[]): boolean {
  const pairs = texts.length - 1;

  if (pairs < 1) {
    return true;
  }

  const outOfOrder = texts.filter((t, i) => i > 0 && (texts[i - 1] ?? '').localeCompare(t) > 0).length;

  return outOfOrder / pairs <= MAX_OUT_OF_ORDER_RATIO;
}

/**
 * The next free 100-code block, read from the `// codes <from>-<to>` header every `*-errors.ts`
 * file carries. Domains never reuse a block, so this only ever moves forward.
 */
export function nextErrorCodeBlock(errorFileContents: string[]): number {
  const highest = errorFileContents.reduce((max, content) => {
    const to = Number(content.match(ERROR_BLOCK)?.[1] ?? 0);

    return to > max ? to : max;
  }, 0);

  return highest ? Math.floor(highest / 100) * 100 + 100 : 1000;
}
