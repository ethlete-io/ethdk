import {
  Edit,
  enclosingOpen,
  escapeRegExp,
  expressionEnd,
  Finding,
  finding,
  matchForward,
  skipSpace,
  skipSpaceBack,
  splitTopLevel,
} from './source-scan.js';

type ParsedFunction = {
  param: { name: string | null; typeStart: number; typeEnd: number } | null;
  bodyStart: number;
  bodyEnd: number;
};

type Rewrite = { edits: Edit[]; nullRelated: boolean; shadowed: boolean; unguarded: boolean };

const IDENTIFIER = /^[A-Za-z_$][\w$]*/;
const OPENER_CALLEE = /^(?:create\w*Opener|open)$/;
const CALLBACK_KEY = /(?<![\w$.])(afterClosed|beforeClosed)(?![\w$])/g;

const parseParam = (masked: string, open: number, close: number): ParsedFunction['param'] => {
  const [first] = splitTopLevel(masked, open + 1, close, ',');
  if (!first) return null;

  const start = skipSpace(masked, first[0]);
  if (start >= first[1]) return null;

  const name = IDENTIFIER.exec(masked.slice(start, first[1]))?.[0] ?? null;
  let colon = -1;
  let depth = 0;

  for (let i = start; i < first[1]; i++) {
    const char = masked[i];
    if (char === '{' || char === '[' || char === '(') depth++;
    else if (char === '}' || char === ']' || char === ')') depth--;
    else if (depth === 0 && char === ':') {
      colon = i;
      break;
    }
  }

  if (colon === -1) return { name, typeStart: -1, typeEnd: -1 };

  let typeEnd = first[1];
  depth = 0;

  for (let i = colon + 1; i < first[1]; i++) {
    const char = masked[i];
    if ('{[(<'.includes(char ?? '')) depth++;
    else if ('}])'.includes(char ?? '') || (char === '>' && masked[i - 1] !== '=')) depth--;
    else if (depth === 0 && char === '=' && masked[i + 1] !== '>') {
      typeEnd = i;
      break;
    }
  }

  return { name, typeStart: colon + 1, typeEnd };
};

const blockAfter = (masked: string, from: number) => {
  const open = masked.indexOf('{', from);
  if (open === -1) return null;

  const between = masked.slice(from, open).trim();
  if (between !== '' && !between.startsWith(':')) return null;
  if (/;|=(?!>)/.test(between)) return null;

  const close = matchForward(masked, open);
  return close === -1 ? null : { bodyStart: open, bodyEnd: close + 1 };
};

/** Parses an inline function (arrow, `function`, or method tail starting at its `(`) at `at`. */
export const parseFunctionAt = (masked: string, at: number, method = false): ParsedFunction | null => {
  let i = skipSpace(masked, at);

  if (masked.startsWith('async', i) && /\s/.test(masked[i + 5] ?? '')) i = skipSpace(masked, i + 5);

  let isFunctionKeyword = false;

  if (!method && /^function(?![\w$])/.test(masked.slice(i))) {
    isFunctionKeyword = true;
    i = skipSpace(masked, i + 8);
    if (masked[i] === '*') i = skipSpace(masked, i + 1);
    const name = IDENTIFIER.exec(masked.slice(i))?.[0];
    if (name) i = skipSpace(masked, i + name.length);
  }

  if (masked[i] === '<') {
    const close = matchAngle(masked, i);
    if (close === -1) return null;
    i = skipSpace(masked, close + 1);
  }

  if (masked[i] !== '(') {
    if (method || isFunctionKeyword) return null;

    const name = IDENTIFIER.exec(masked.slice(i))?.[0];
    if (!name) return null;

    const arrow = skipSpace(masked, i + name.length);
    if (!masked.startsWith('=>', arrow)) return null;

    return { param: { name, typeStart: -1, typeEnd: -1 }, ...arrowBody(masked, arrow + 2) };
  }

  const close = matchForward(masked, i);
  if (close === -1) return null;

  const param = parseParam(masked, i, close);

  if (method || isFunctionKeyword) {
    const block = blockAfter(masked, close + 1);
    return block ? { param, ...block } : null;
  }

  const end = expressionEnd(masked, close + 1);
  const arrow = masked.indexOf('=>', close + 1);
  if (arrow === -1 || arrow > end) return null;

  const between = masked.slice(close + 1, arrow).trim();
  if (between !== '' && !between.startsWith(':')) return null;

  return { param, ...arrowBody(masked, arrow + 2) };
};

const matchAngle = (masked: string, open: number) => {
  let depth = 0;

  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '<') depth++;
    else if (masked[i] === '>' && masked[i - 1] !== '=' && --depth === 0) return i;
  }

  return -1;
};

const arrowBody = (masked: string, from: number) => {
  const start = skipSpace(masked, from);

  if (masked[start] === '{') return { bodyStart: start, bodyEnd: matchForward(masked, start) + 1 };

  return { bodyStart: start, bodyEnd: expressionEnd(masked, start) };
};

const nullComparisons = (masked: string, name: string, from: number, to: number) => {
  const body = masked.slice(from, to);
  const id = escapeRegExp(name);
  const offsets: number[] = [];

  for (const match of body.matchAll(new RegExp(`(?<![\\w$.])${id}\\s*[!=]==\\s*(null)(?![\\w$])`, 'g'))) {
    offsets.push(from + (match.index ?? 0) + match[0].length - 4);
  }

  for (const match of body.matchAll(new RegExp(`(?<![\\w$.])null\\s*[!=]==\\s*${id}(?![\\w$])`, 'g'))) {
    offsets.push(from + (match.index ?? 0));
  }

  return offsets;
};

const isShadowed = (masked: string, name: string, from: number, to: number) => {
  const id = escapeRegExp(name);

  return new RegExp(
    [
      `\\b(?:const|let|var)\\s+${id}(?![\\w$])`,
      `\\bfunction\\b[^(]*\\([^)]*(?<![\\w$.])${id}(?![\\w$])`,
      `(?<![\\w$.])${id}\\s*=>`,
      `(?<![\\w$)\\]])\\([^()]*(?<![\\w$.])${id}(?![\\w$])[^()]*\\)\\s*(?::[^=]*)?=>`,
    ].join('|'),
  ).test(masked.slice(from + 1, to));
};

const SAFE_AFTER = /^\s*(?:[!=]==?|\?\?|\?(?![.?])|&&|\|\|)/;

/** Whether the parameter reaches something other than a check before a check narrows it. */
const hasUnguardedUse = (masked: string, name: string, from: number, to: number) => {
  const id = escapeRegExp(name);
  const body = masked.slice(from, to);
  const guard = new RegExp(
    [
      `(?<![\\w$.])${id}\\s*!==?\\s*(?:null|undefined)`,
      `(?:null|undefined)\\s*!==?\\s*${id}(?![\\w$])`,
      `\\b(?:if|while)\\s*\\(\\s*${id}\\s*\\)`,
      `(?<![\\w$.])${id}\\s*(?:&&|\\?(?![.?]))`,
      `\\bif\\s*\\(\\s*(?:!\\s*${id}|${id}\\s*===?\\s*(?:null|undefined)|(?:null|undefined)\\s*===?\\s*${id})\\s*\\)\\s*\\{?\\s*(?:return|continue|throw)\\b`,
    ].join('|'),
  );
  const firstGuard = guard.exec(body)?.index ?? Infinity;

  for (const match of body.matchAll(new RegExp(`(?<![\\w$.])${id}(?![\\w$])`, 'g'))) {
    const at = match.index ?? 0;
    const before = body.slice(0, at);
    const after = body.slice(at + name.length);

    if (/!\s*$/.test(before) && !/!=\s*$/.test(before)) continue;
    if (/(?:null|undefined)\s*[!=]==?\s*$/.test(before)) continue;
    if (SAFE_AFTER.test(after)) continue;
    if (/^\s*:/.test(after) && /[{,]\s*$/.test(before)) continue;
    if (/\b(?:if|while)\s*\(\s*$/.test(before) && /^\s*\)/.test(after)) continue;
    if (at > firstGuard) continue;

    return true;
  }

  return false;
};

const rewriteType = (source: string, masked: string, typeStart: number, typeEnd: number): Edit | null => {
  if (typeStart === -1) return null;

  const members = splitTopLevel(masked, typeStart, typeEnd, '|')
    .map(([start, end]) => source.slice(start, end).trim())
    .filter((member) => member !== '');

  if (!members.includes('null')) return null;

  const hasUndefined = members.includes('undefined');
  const next = members.flatMap((member) => (member !== 'null' ? [member] : hasUndefined ? [] : ['undefined']));
  const original = source.slice(typeStart, typeEnd);
  const leading = /^\s*/.exec(original)?.[0] ?? '';
  const trailing = /\s*$/.exec(original)?.[0] ?? '';

  return { start: typeStart, end: typeEnd, text: `${leading}${next.join(' | ')}${trailing}` };
};

const rewriteFunction = (source: string, masked: string, fn: ParsedFunction): Rewrite => {
  const edits: Edit[] = [];
  const param = fn.param;

  if (!param) return { edits, nullRelated: false, shadowed: false, unguarded: false };

  const typeEdit = rewriteType(source, masked, param.typeStart, param.typeEnd);
  if (typeEdit) edits.push(typeEdit);

  const comparisons = param.name ? nullComparisons(masked, param.name, fn.bodyStart, fn.bodyEnd) : [];
  const shadowed =
    comparisons.length > 0 && param.name !== null && isShadowed(masked, param.name, fn.bodyStart, fn.bodyEnd);

  if (!shadowed) {
    for (const offset of comparisons) edits.push({ start: offset, end: offset + 4, text: 'undefined' });
  }

  const unguarded =
    typeEdit !== null && param.name !== null && hasUnguardedUse(masked, param.name, fn.bodyStart, fn.bodyEnd);

  return { edits, nullRelated: edits.length > 0 || comparisons.length > 0, shadowed, unguarded };
};

const calleeBefore = (masked: string, paren: number) => {
  let i = skipSpaceBack(masked, paren - 1);

  if (masked[i] === '>') {
    let depth = 0;
    for (; i >= 0; i--) {
      if (masked[i] === '>' && masked[i - 1] !== '=') depth++;
      else if (masked[i] === '<' && --depth === 0) break;
    }
    i = skipSpaceBack(masked, i - 1);
  }

  let start = i;
  while (start >= 0 && /[\w$]/.test(masked[start] ?? '')) start--;

  return masked.slice(start + 1, i + 1);
};

type Context = 'opener' | 'object' | 'other';

const contextOf = (masked: string, keyIndex: number): Context => {
  const open = enclosingOpen(masked, keyIndex, '{');
  if (open === -1) return 'other';

  const before = skipSpaceBack(masked, open - 1);
  const char = masked[before];
  const paren = char === '(' ? before : char === ',' ? enclosingOpen(masked, before, '(') : -1;

  if (paren !== -1) return OPENER_CALLEE.test(calleeBefore(masked, paren)) ? 'opener' : 'object';

  if (char === '=' && masked[before - 1] !== '=') {
    const lineStart = Math.max(masked.lastIndexOf(';', before), masked.lastIndexOf('\n', before));
    return /:\s*Overlay\w*Config\b/.test(masked.slice(lineStart + 1, before)) ? 'opener' : 'object';
  }

  if ((char && ':[?'.includes(char)) || /\breturn$/.test(masked.slice(0, before + 1))) return 'object';

  return 'other';
};

const declarationOf = (masked: string, name: string) => {
  const id = escapeRegExp(name);
  const patterns = [
    new RegExp(
      `(?:^|\\n)[ \\t]*(?:(?:public|private|protected|readonly|static|override|async)\\s+)*${id}\\s*(=\\s*)?(?=[(<]|async\\b|function\\b)`,
      'g',
    ),
    new RegExp(`\\b(?:const|let|var)\\s+${id}\\s*(?::[^=;]+)?(=\\s*)(?=[(<]|async\\b|function\\b)`, 'g'),
    new RegExp(`\\bfunction\\s+${id}\\s*(?=[(<])`, 'g'),
  ];

  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern)) {
      const at = (match.index ?? 0) + match[0].length;
      const fn = parseFunctionAt(masked, at, match[1] === undefined);
      if (fn) return { offset: at, fn };
    }
  }

  return null;
};

const countUses = (masked: string, name: string) =>
  [...masked.matchAll(new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`, 'g'))].length;

export const migrateOverlayResult = (source: string, masked: string) => {
  const edits: Edit[] = [];
  const findings: Finding[] = [];

  const reportUnguarded = (fn: ParsedFunction, rewrite: Rewrite) => {
    if (!rewrite.unguarded || !fn.param?.name) return;

    findings.push(
      finding(
        source,
        fn.param.typeStart,
        `\`${fn.param.name}\` is \`T | undefined\` now and reaches code that may expect \`T | null\`: check where it goes.`,
      ),
    );
  };

  const resolveReference = (name: string, siteOffset: number, uses: number) => {
    const declaration = declarationOf(masked, name);

    if (!declaration) {
      findings.push(
        finding(
          source,
          siteOffset,
          `\`${name}\` is not declared in this file: if it takes the result as \`T | null\`, make that \`T | undefined\`.`,
        ),
      );
      return;
    }

    const rewrite = rewriteFunction(source, masked, declaration.fn);
    if (!rewrite.nullRelated) return;

    if (countUses(masked, name) > uses || rewrite.shadowed) {
      findings.push(
        finding(
          source,
          declaration.offset,
          `\`${name}\` also runs outside the overlay callback: its result parameter is \`T | undefined\` now, not \`T | null\`.`,
        ),
      );
      return;
    }

    edits.push(...rewrite.edits);
    reportUnguarded(declaration.fn, rewrite);
  };

  for (const match of masked.matchAll(CALLBACK_KEY)) {
    const keyIndex = match.index ?? 0;
    const key = match[1] ?? '';
    const afterKey = skipSpace(masked, keyIndex + key.length);
    const keyStart = skipSpaceBack(masked, keyIndex - 1);

    if (masked[keyStart] !== '{' && masked[keyStart] !== ',') continue;

    const context = contextOf(masked, keyIndex);
    if (context === 'other') continue;

    const next = masked[afterKey];
    let fn: ParsedFunction | null = null;
    let reference: string | null = null;

    if (next === ':') {
      const valueStart = skipSpace(masked, afterKey + 1);
      fn = parseFunctionAt(masked, valueStart);

      if (!fn) {
        const value = masked.slice(valueStart, expressionEnd(masked, valueStart)).trim();
        reference = /^(?:this\.)?([A-Za-z_$][\w$]*)$/.exec(value)?.[1] ?? null;
      }
    } else if (next === '(' || next === '<') {
      fn = parseFunctionAt(masked, afterKey, true);
    } else if (next === ',' || next === '}') {
      reference = key;
    }

    if (context === 'object') {
      const rewrite = fn ? rewriteFunction(source, masked, fn) : null;
      if (rewrite?.nullRelated) {
        findings.push(
          finding(
            source,
            keyIndex,
            `\`${key}\` is not passed straight to an overlay opener: if it is one, its result is \`T | undefined\` now, not \`T | null\`.`,
          ),
        );
      }
      continue;
    }

    if (reference) {
      resolveReference(reference, keyIndex, 2);
      continue;
    }

    if (!fn) {
      findings.push(
        finding(source, keyIndex, `\`${key}\` is not an inline function: check that it takes \`T | undefined\`.`),
      );
      continue;
    }

    const rewrite = rewriteFunction(source, masked, fn);

    if (rewrite.shadowed) {
      findings.push(
        finding(
          source,
          keyIndex,
          `\`${key}\` shadows its result parameter: compare the result with \`undefined\`, not \`null\`.`,
        ),
      );
    } else {
      edits.push(...rewrite.edits);
      reportUnguarded(fn, rewrite);
    }

    const forwarded =
      fn.param?.name &&
      new RegExp(`^(?:this\\.)?([A-Za-z_$][\\w$]*)\\(\\s*${escapeRegExp(fn.param.name)}\\s*\\)$`).exec(
        masked.slice(fn.bodyStart, fn.bodyEnd).trim(),
      )?.[1];

    if (forwarded) resolveReference(forwarded, keyIndex, 2);
  }

  return { edits, findings };
};

const PALETTE = /(?<![\w$.])injectCommandPalette(?![\w$])/g;

export const renameCommandPalette = (masked: string): Edit[] =>
  [...masked.matchAll(PALETTE)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + 'injectCommandPalette'.length,
    text: 'createCommandPaletteOpener',
  }));

export const dedupeComponentsImports = (source: string) =>
  source.replace(
    /import\s*\{([^}]*)\}\s*from\s*(['"])@ethlete\/components\2/g,
    (statement: string, specifiers: string, quote: string) => {
      const names = specifiers
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '');
      const unique = [...new Set(names)];

      return unique.length === names.length
        ? statement
        : `import { ${unique.join(', ')} } from ${quote}@ethlete/components${quote}`;
    },
  );
