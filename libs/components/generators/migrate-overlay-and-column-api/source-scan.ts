export type Edit = { start: number; end: number; text: string };

export type Finding = { line: number; reason: string; text: string };

const OPENERS = '([{';
const CLOSERS = ')]}';

/** Replaces string, template and comment contents with spaces, keeping every offset and newline. */
export const maskSource = (source: string) => {
  const out = source.split('');
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  const templateDepths: number[] = [];
  let depth = 0;
  let i = 0;

  const scanTemplate = () => {
    const start = i;

    while (i < source.length) {
      if (source[i] === '\\') {
        i += 2;
        continue;
      }

      if (source[i] === '`') {
        blank(start, i);
        i++;
        return;
      }

      if (source[i] === '$' && source[i + 1] === '{') {
        blank(start, i);
        templateDepths.push(depth);
        depth++;
        i += 2;
        return;
      }

      i++;
    }

    blank(start, i);
  };

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (char === "'" || char === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== char && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
    } else if (char === '`') {
      i++;
      scanTemplate();
    } else if (char === '{') {
      depth++;
      i++;
    } else if (char === '}') {
      depth--;
      i++;
      if (templateDepths.length > 0 && templateDepths[templateDepths.length - 1] === depth) {
        templateDepths.pop();
        scanTemplate();
      }
    } else {
      i++;
    }
  }

  return out.join('');
};

/** The index of the bracket closing the one at `open`, or -1. */
export const matchForward = (masked: string, open: number) => {
  let depth = 0;

  for (let i = open; i < masked.length; i++) {
    const char = masked[i] ?? '';
    if (OPENERS.includes(char)) depth++;
    else if (CLOSERS.includes(char) && --depth === 0) return i;
  }

  return -1;
};

/** The index of the unclosed `bracket` that encloses `from`, or -1. */
export const enclosingOpen = (masked: string, from: number, bracket: string) => {
  let depth = 0;

  for (let i = from - 1; i >= 0; i--) {
    const char = masked[i] ?? '';
    if (CLOSERS.includes(char)) depth++;
    else if (OPENERS.includes(char)) {
      if (depth === 0) return char === bracket ? i : -1;
      depth--;
    }
  }

  return -1;
};

/** The end of an expression starting at `from`: the first depth-0 `,` `;` or unmatched closer. */
export const expressionEnd = (masked: string, from: number) => {
  let depth = 0;

  for (let i = from; i < masked.length; i++) {
    const char = masked[i] ?? '';
    if (OPENERS.includes(char)) depth++;
    else if (CLOSERS.includes(char)) {
      if (depth === 0) return i;
      depth--;
    } else if (depth === 0 && (char === ',' || char === ';')) return i;
  }

  return masked.length;
};

export const skipSpace = (masked: string, from: number) => {
  let i = from;
  while (i < masked.length && /\s/.test(masked[i] ?? '')) i++;
  return i;
};

export const skipSpaceBack = (masked: string, from: number) => {
  let i = from;
  while (i >= 0 && /\s/.test(masked[i] ?? '')) i--;
  return i;
};

/** Splits `text` at depth-0 occurrences of `separator`, returning `[start, end]` ranges. */
export const splitTopLevel = (masked: string, from: number, to: number, separator: string) => {
  const ranges: [number, number][] = [];
  let depth = 0;
  let start = from;

  for (let i = from; i < to; i++) {
    const char = masked[i] ?? '';
    if (OPENERS.includes(char) || char === '<') depth++;
    else if (CLOSERS.includes(char) || (char === '>' && masked[i - 1] !== '=')) depth--;
    else if (depth === 0 && char === separator) {
      ranges.push([start, i]);
      start = i + 1;
    }
  }

  ranges.push([start, to]);
  return ranges;
};

export const lineAt = (source: string, offset: number) => source.slice(0, offset).split('\n').length;

export const lineText = (source: string, offset: number) =>
  source.split('\n')[lineAt(source, offset) - 1]?.trim() ?? '';

export const finding = (source: string, offset: number, reason: string): Finding => ({
  line: lineAt(source, offset),
  reason,
  text: lineText(source, offset),
});

export const applyEdits = (source: string, edits: Edit[]) => {
  const unique = [...new Map(edits.map((edit) => [`${edit.start}:${edit.end}`, edit])).values()];

  return unique
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
};

export const importsEthleteComponents = (source: string) =>
  /from\s*['"]@ethlete\/components(?:\/[^'"]*)?['"]/.test(source);

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
