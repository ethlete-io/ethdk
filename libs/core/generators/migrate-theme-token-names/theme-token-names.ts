import {
  RENAMED_TOKEN_LEFT,
  RETIRED_TOKEN_FAMILY,
  SURFACE_TRIPLET_READ,
  tailwindColorRenames,
  tailwindSurfaceRenames,
  THEME_TOKEN_RENAME_BY_OLD,
  TokenRename,
} from './token-names.js';

export type ThemeTokenFinding = { line: number; reason: string; text: string };

export type TailwindThemeNames = {
  colorPrefixes: Map<string, Set<string>>;
  surfacePrefixes: Map<string, Set<string>>;
};

export type ThemeTokenMigrationResult = {
  content: string;
  changed: boolean;
  findings: ThemeTokenFinding[];
};

const GENERATED_COLOR_MARKER = '@ethlete/core:tailwind-4-color-theme';
const GENERATED_SURFACE_MARKER = '@ethlete/core:tailwind-4-surface-theme';
const LITERAL_TRIPLET = /^\d+(?:\.\d+)?%?(?:[\s_]+\d+(?:\.\d+)?%?){2}$/;
const NAME_CHAR = /[\w-]/;
const CALL_NAME_CHAR = /[a-zA-Z0-9-]/;
const TAILWIND_COLOR_UTILITIES = [
  'bg',
  'text',
  'decoration',
  'border(?:-[xytrbles])?',
  'divide',
  'outline',
  'ring',
  'ring-offset',
  'inset-ring',
  'shadow',
  'inset-shadow',
  'drop-shadow',
  'text-shadow',
  'accent',
  'caret',
  'fill',
  'stroke',
  'placeholder',
  'from',
  'via',
  'to',
].join('|');
const TAILWIND_SHORTHAND = /^\(([a-z-]+:)?(--[a-zA-Z][\w-]*)\)/;

export const emptyTailwindThemeNames = (): TailwindThemeNames => ({
  colorPrefixes: new Map(),
  surfacePrefixes: new Map(),
});

export const isGeneratedThemeFile = (content: string) =>
  content.includes(GENERATED_COLOR_MARKER) || content.includes(GENERATED_SURFACE_MARKER);

/** Reads the Tailwind prefix and the theme names from a file written by a theme generator. */
export const collectTailwindThemeNames = (content: string, into: TailwindThemeNames) => {
  const isColor = content.includes(GENERATED_COLOR_MARKER);
  const isSurface = content.includes(GENERATED_SURFACE_MARKER);

  if (!isColor && !isSurface) return into;

  const prefix = /--prefix=([\w-]+)/.exec(content)?.[1] ?? 'et';
  const target = isColor ? into.colorPrefixes : into.surfacePrefixes;
  const names = target.get(prefix) ?? new Set<string>();
  const marker = isColor ? 'theme' : 'surface';

  for (const match of content.matchAll(new RegExp(`/\\* ([\\w-]+) ${marker} \\*/`, 'g'))) {
    names.add(match[1] as string);
  }

  target.set(prefix, names);

  return into;
};

const findClose = (text: string, open: number) => {
  let depth = 0;

  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
};

const splitTopLevel = (text: string, separators: string) => {
  const parts: { text: string; separator: string | null }[] = [];
  let depth = 0;
  let start = 0;
  let separator: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;

    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && separators.includes(char)) {
      parts.push({ text: text.slice(start, i), separator });
      separator = char;
      start = i + 1;
    }
  }

  parts.push({ text: text.slice(start), separator });

  return parts;
};

const trimSpace = (text: string) => text.replace(/^[\s_]+|[\s_]+$/g, '');

type VarChain = { names: string[]; fallback: string | null };

const parseVarChain = (raw: string): VarChain | null => {
  const text = trimSpace(raw);

  if (!text.startsWith('var(') || findClose(text, 3) !== text.length - 1) return null;

  const [head, ...rest] = splitTopLevel(text.slice(4, -1), ',');
  const name = trimSpace(head?.text ?? '');

  if (!name.startsWith('--')) return null;

  if (rest.length === 0) return { names: [name], fallback: null };

  const fallbackText = rest.map((part, index) => (index === 0 ? part.text : `,${part.text}`)).join('');
  const nested = parseVarChain(fallbackText);

  if (nested) return { names: [name, ...nested.names], fallback: nested.fallback };

  return { names: [name], fallback: trimSpace(fallbackText) };
};

const entryOf = (name: string): TokenRename | undefined => THEME_TOKEN_RENAME_BY_OLD.get(name);

const lineOf = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

const lineText = (text: string, line: number) => (text.split('\n')[line - 1] ?? '').trim();

const toPercent = (alpha: string) => {
  const number = /^(\d*\.?\d+)$/.exec(alpha);

  if (number) return `${+(Number(number[1]) * 100).toFixed(4)}%`;
  if (/^\d*\.?\d+%$/.test(alpha)) return alpha;
  if (alpha.startsWith('calc(') && findClose(alpha, 4) === alpha.length - 1) {
    return `calc((${alpha.slice(5, -1)}) * 100%)`;
  }

  return `calc(${alpha} * 100%)`;
};

const isDroppedOpacity = (alpha: string) => {
  const chain = parseVarChain(alpha);

  return !!chain && entryOf(chain.names[0] as string)?.kind === 'dropped-opacity';
};

type Context = { property: string | null; insideRgb: boolean };

class FileMigration {
  readonly findings: ThemeTokenFinding[] = [];

  constructor(private readonly source: string) {}

  report(offset: number, reason: string) {
    const line = lineOf(this.source, offset);

    if (this.findings.some((finding) => finding.line === line && finding.reason === reason)) return;

    this.findings.push({ line, reason, text: lineText(this.source, line) });
  }

  propertyAt(offset: number) {
    let start = offset;

    while (start > 0 && !';{}["\'`'.includes(this.source[start - 1] as string)) start--;

    return /(-{0,2}[a-zA-Z_][\w-]*)\s*:[^:]*$/.exec(this.source.slice(start, offset))?.[1] ?? null;
  }

  rewriteChainAsColor(chain: VarChain) {
    const fallback = chain.fallback === null ? null : this.literalOrRewrite(chain.fallback);

    return chain.names.reduceRight<string | null>((inner, name) => {
      const next = entryOf(name)?.new ?? name;

      return inner === null ? `var(${next})` : `var(${next}, ${inner})`;
    }, fallback);
  }

  literalOrRewrite(fallback: string) {
    return LITERAL_TRIPLET.test(fallback) ? `rgb(${fallback.replace(/_/g, ' ')})` : fallback;
  }

  rewriteRgb(call: string, offset: number): string | null {
    const open = call.indexOf('(');
    const inner = call.slice(open + 1, -1);
    const parts = splitTopLevel(inner, '/,');
    const chain = parseVarChain(parts[0]?.text ?? '');

    if (!chain || parts.length > 2) return null;

    const entries = chain.names.map(entryOf);

    if (entries.every((entry) => entry === undefined)) return null;

    if (entries.some((entry) => entry?.kind !== 'triplet')) {
      this.report(offset, 'rgb() over a var chain that mixes old triplet names with other names: rewrite it by hand');

      return null;
    }

    if (chain.fallback !== null && !LITERAL_TRIPLET.test(chain.fallback)) {
      this.report(offset, 'rgb() over an old triplet name with a non-literal fallback: rewrite it by hand');

      return null;
    }

    const underscores = !/\s/.test(inner) && inner.includes('_');
    const color = this.rewriteChainAsColor(chain) as string;
    const alpha = parts[1] ? trimSpace(parts[1].text) : null;
    let result: string;

    if (alpha === null || isDroppedOpacity(alpha)) {
      result = color;
    } else {
      const rewrittenAlpha = this.rewriteValue(alpha, offset, { property: null, insideRgb: true });

      result = `color-mix(in srgb, ${color} ${toPercent(rewrittenAlpha)}, transparent)`;
    }

    return underscores ? result.replace(/, /g, ',').replace(/ /g, '_') : result;
  }

  rewriteVar(call: string, offset: number, context: Context): string | null {
    const chain = parseVarChain(call);

    if (!chain) return null;

    const entries = chain.names.map(entryOf);

    if (entries.every((entry) => entry === undefined)) return null;

    for (const entry of entries) {
      if (!entry) continue;

      if (entry.kind === 'dropped' || entry.kind === 'dropped-opacity') {
        this.report(offset, `${entry.old} is removed: replace it by hand`);

        return null;
      }

      if (
        entry.kind === 'triplet' &&
        entry.old !== entry.new &&
        !context.insideRgb &&
        !this.isTripletProperty(context.property)
      ) {
        this.report(
          offset,
          `${entry.old} is a triplet read outside rgb()${context.property ? ` (in ${context.property})` : ''}: check every reader by hand`,
        );

        return null;
      }
    }

    let renamed = call.replace(/(var\(\s*)(--[\w-]+)/g, (whole, head: string, name: string) => {
      const next = entryOf(name)?.new;

      return next ? `${head}${next}` : whole;
    });

    if (entries[0]?.kind === 'opacity' && chain.names.length === 1 && chain.fallback === null) {
      renamed = `${renamed.slice(0, -1)}, 1)`;
    }

    if (chain.fallback !== null && LITERAL_TRIPLET.test(chain.fallback)) {
      const at = renamed.lastIndexOf(chain.fallback);

      renamed = `${renamed.slice(0, at)}rgb(${chain.fallback.replace(/_/g, ' ')})${renamed.slice(at + chain.fallback.length)}`;
    }

    return renamed;
  }

  rewriteShorthand([call, type, name]: RegExpExecArray, offset: number) {
    if (entryOf(name as string)?.kind === 'opacity') {
      this.report(offset, `${name} has no shorthand form after the rename: rewrite it as an arbitrary value by hand`);

      return call;
    }

    const renamed = this.rewriteVar(`var(${name})`, offset, { property: null, insideRgb: false });

    return renamed === null ? call : `(${type ?? ''}${renamed.slice('var('.length)}`;
  }

  isTripletProperty(property: string | null) {
    return !!property && entryOf(property)?.kind === 'triplet';
  }

  rewriteValue(text: string, baseOffset: number, context: Context): string {
    let output = '';
    let i = 0;

    while (i < text.length) {
      const shorthand =
        i > 1 && text[i - 1] === '-' && NAME_CHAR.test(text[i - 2] as string)
          ? TAILWIND_SHORTHAND.exec(text.slice(i))
          : null;

      if (shorthand) {
        output += this.rewriteShorthand(shorthand, baseOffset + i);
        i += shorthand[0].length;
        continue;
      }

      const match = /^(rgba?|var)\(/.exec(text.slice(i));
      const boundary = i === 0 || !CALL_NAME_CHAR.test(text[i - 1] as string);

      if (!match || !boundary) {
        output += text[i];
        i++;
        continue;
      }

      const open = i + (match[1] as string).length;
      const close = findClose(text, open);

      if (close === -1) {
        output += text.slice(i);
        break;
      }

      const call = text.slice(i, close + 1);
      const offset = baseOffset + i;
      const callContext =
        context.property !== null || context.insideRgb ? context : { ...context, property: this.propertyAt(offset) };
      const isVar = match[1] === 'var';
      const reported = this.findings.length;
      const rewritten = isVar ? this.rewriteVar(call, offset, callContext) : this.rewriteRgb(call, offset);

      if (rewritten !== null) output += rewritten;
      else if (this.findings.length > reported) output += call;
      else {
        const headLength = (match[1] as string).length + 1;
        const body = call.slice(headLength, -1);
        const bodyContext = isVar ? callContext : { ...callContext, insideRgb: true };

        output += `${call.slice(0, headLength)}${this.rewriteValue(body, offset + headLength, bodyContext)})`;
      }

      i = close + 1;
    }

    return output;
  }
}

type Declaration = { start: number; end: number; property: string; valueStart: number; value: string };

const findDeclarations = (text: string) => {
  const declarations: Declaration[] = [];
  const pattern = /(^|[;{\s["'`])(--[a-zA-Z][\w-]*)\s*:/g;

  for (const match of text.matchAll(pattern)) {
    const property = match[2] as string;

    if (!entryOf(property)) continue;

    const start = (match.index as number) + (match[1] as string).length;
    const valueStart = (match.index as number) + match[0].length;
    let depth = 0;
    let end = valueStart;

    while (end < text.length) {
      const char = text[end] as string;

      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (depth === 0 && ';}]\'"`'.includes(char)) break;

      end++;
    }

    declarations.push({ start, end, property, valueStart, value: text.slice(valueStart, end) });
  }

  return declarations;
};

const blockOf = (text: string, offset: number) => {
  let depth = 0;
  let start = offset;

  while (start > 0) {
    const char = text[start - 1];

    if (char === '}') depth++;
    else if (char === '{') {
      if (depth === 0) break;
      depth--;
    }

    start--;
  }

  depth = 0;
  let end = offset;

  while (end < text.length) {
    const char = text[end];

    if (char === '{') depth++;
    else if (char === '}') {
      if (depth === 0) break;
      depth--;
    }

    end++;
  }

  return { start, end };
};

const rewriteDeclaration = (migration: FileMigration, text: string, declaration: Declaration): string | null => {
  const entry = entryOf(declaration.property) as TokenRename;
  const value = trimSpace(declaration.value);
  const offset = declaration.start;

  if (entry.kind === 'dropped') {
    migration.report(offset, `${entry.old} is removed: delete or replace this declaration by hand`);

    return null;
  }

  if (entry.kind === 'dropped-opacity') {
    if (value === '1') return '';

    migration.report(offset, `${entry.old} is removed and only 1 is supported: replace this declaration by hand`);

    return null;
  }

  if (/^--(?:et-theme-color|et-surface)-.+-rgb$/.test(entry.old)) {
    const solid = `${entry.old.slice(0, -'rgb'.length)}solid`;
    const block = blockOf(text, offset);

    if (!new RegExp(`${solid}\\s*:`).test(text.slice(block.start, block.end))) {
      migration.report(
        offset,
        `${entry.old} is reassigned without ${solid}: after the rename every reader of ${entry.new} changes, so rewrite this block by hand`,
      );

      return null;
    }
  }

  const next = entry.new as string;
  let nextValue: string;

  if (entry.kind === 'triplet') {
    if (LITERAL_TRIPLET.test(value)) {
      nextValue = `rgb(${value.replace(/_/g, ' ')})`;
    } else {
      const chain = parseVarChain(value);
      const known = chain && chain.names.every((name) => entryOf(name)?.kind === 'triplet');
      const fallbackOk = !chain?.fallback || LITERAL_TRIPLET.test(chain.fallback);

      if (entry.old === entry.new && !(chain && known && fallbackOk)) {
        nextValue = migration.rewriteValue(declaration.value, declaration.valueStart, {
          property: declaration.property,
          insideRgb: false,
        });
      } else if (!chain || !known || !fallbackOk) {
        migration.report(
          offset,
          `${entry.old} holds a triplet; its new name ${next} holds a color: rewrite this value by hand`,
        );

        return null;
      } else {
        nextValue = migration.rewriteChainAsColor(chain) as string;
      }
    }
  } else {
    nextValue = migration.rewriteValue(declaration.value, declaration.valueStart, {
      property: declaration.property,
      insideRgb: false,
    });
  }

  if (new RegExp(`var\\(\\s*${next}\\s*[,)]`).test(nextValue) && entry.kind !== 'opacity') return '';

  const leading = /^\s*/.exec(declaration.value)?.[0] ?? '';

  return `${next}:${leading}${trimSpace(nextValue)}`;
};

const removeDeclaration = (text: string, start: number, end: number) => {
  let from = start;
  let to = end < text.length && text[end] === ';' ? end + 1 : end;

  while (from > 0 && /[ \t]/.test(text[from - 1] as string)) from--;

  if ((from === 0 || text[from - 1] === '\n') && text[to] === '\n') to++;

  return { from, to };
};

const renameTailwind = (text: string, names: TailwindThemeNames) => {
  const map = new Map<string, string>();

  for (const [prefix, themes] of names.colorPrefixes) {
    for (const rename of tailwindColorRenames(prefix, [...themes])) map.set(rename.old, rename.new);
  }

  for (const [prefix, surfaces] of names.surfacePrefixes) {
    for (const rename of tailwindSurfaceRenames(prefix, [...surfaces])) map.set(rename.old, rename.new);
  }

  if (map.size === 0) return text;

  const prefixes = [...new Set([...names.colorPrefixes.keys(), ...names.surfacePrefixes.keys()])];
  const pattern = new RegExp(
    `(?<=(?:^|[^\\w-])(?:--color|${TAILWIND_COLOR_UTILITIES})-)(?:${prefixes.join('|')})-[a-z0-9-]*[a-z0-9]`,
    'g',
  );

  return text.replace(pattern, (token) => map.get(token) ?? token);
};

const collectLeftovers = (migration: FileMigration, result: string) => {
  const leftovers: ThemeTokenFinding[] = [];
  const lines = result.split('\n');

  lines.forEach((line, index) => {
    const families = [...line.matchAll(RETIRED_TOKEN_FAMILY), ...line.matchAll(RENAMED_TOKEN_LEFT)].map(
      (match) => match[0],
    );
    const surfaceTriplets = [...line.matchAll(SURFACE_TRIPLET_READ)];

    if (families.length === 0 && surfaceTriplets.length === 0) return;

    const reason =
      families.length > 0
        ? `old theme token left: ${[...new Set(families)].join(', ')}`
        : 'rgb() over a surface name that is a color now';

    leftovers.push({ line: index + 1, reason, text: line.trim() });
  });

  return [
    ...migration.findings.map((finding) => ({ ...finding, line: lineIn(result, finding.text) ?? finding.line })),
    ...leftovers.filter((left) => !migration.findings.some((f) => f.text === left.text)),
  ];
};

const lineIn = (text: string, needle: string) => {
  const index = text.split('\n').findIndex((line) => line.trim() === needle);

  return index === -1 ? null : index + 1;
};

/**
 * Renames the theming revision's old CSS custom properties and Tailwind color names in one file's text. A place the
 * engine cannot rewrite safely stays as it is and comes back as a finding with its line.
 */
export const migrateThemeTokenNames = (
  content: string,
  names: TailwindThemeNames = emptyTailwindThemeNames(),
): ThemeTokenMigrationResult => {
  if (isGeneratedThemeFile(content)) return { content, changed: false, findings: [] };

  const migration = new FileMigration(content);
  const declarations = findDeclarations(content);
  const mergedNames = new Map<number, Map<string, { property: string; replacement: string }>>();
  let output = '';
  let cursor = 0;

  for (const declaration of declarations) {
    if (declaration.start < cursor) continue;

    output += migration.rewriteValue(content.slice(cursor, declaration.start), cursor, {
      property: null,
      insideRgb: false,
    });

    let replacement = rewriteDeclaration(migration, content, declaration);

    if (replacement) {
      const next = entryOf(declaration.property)?.new as string;
      const blockStart = blockOf(content, declaration.start).start;
      const merged = mergedNames.get(blockStart) ?? new Map<string, { property: string; replacement: string }>();
      const earlier = merged.get(next);

      if (earlier && earlier.property !== declaration.property) {
        if (earlier.replacement.replace(/\s/g, '') === replacement.replace(/\s/g, '')) {
          replacement = '';
        } else {
          migration.report(
            declaration.start,
            `${earlier.property} and ${declaration.property} are both set here and merge into ${next}: keep one by hand`,
          );
          replacement = null;
        }
      } else {
        merged.set(next, { property: declaration.property, replacement });
        mergedNames.set(blockStart, merged);
      }
    }

    if (replacement === null) {
      output += content.slice(declaration.start, declaration.end);
      cursor = declaration.end;
    } else if (replacement === '') {
      const { from, to } = removeDeclaration(content, declaration.start, declaration.end);

      output = output.slice(0, output.length - (declaration.start - from));
      cursor = to;
    } else {
      output += replacement;
      cursor = declaration.end;
    }
  }

  output += migration.rewriteValue(content.slice(cursor), cursor, { property: null, insideRgb: false });
  output = renameTailwind(output, names);

  const findings = collectLeftovers(migration, output).sort((a, b) => a.line - b.line);

  return { content: output, changed: output !== content, findings };
};
