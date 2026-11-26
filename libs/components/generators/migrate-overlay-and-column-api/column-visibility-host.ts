import {
  Edit,
  enclosingOpen,
  Finding,
  finding,
  matchForward,
  skipSpace,
  skipSpaceBack,
  splitTopLevel,
} from './source-scan.js';

const HOST = 'TableColumnVisibilityHost';
const HOST_PATTERN = new RegExp(`(?<![\\w$])${HOST}(?![\\w$])`, 'g');

const literalAfterAnnotation = (masked: string, after: number) => {
  if (masked[after] === '=' && masked[after + 1] !== '>' && masked[after + 1] !== '=') {
    const value = skipSpace(masked, after + 1);
    return masked[value] === '{' ? value : -1;
  }

  if (masked.startsWith('=>', after)) {
    const value = skipSpace(masked, after + 2);
    if (masked[value] !== '(') return -1;
    const inner = skipSpace(masked, value + 1);
    return masked[inner] === '{' ? inner : -1;
  }

  return -1;
};

const literalOf = (masked: string, index: number) => {
  const before = skipSpaceBack(masked, index - 1);
  const after = skipSpace(masked, index + HOST.length);

  if (masked[before] === ':') return literalAfterAnnotation(masked, after);

  const keyword = /(?:satisfies|as)$/.exec(masked.slice(Math.max(0, before - 8), before + 1));
  if (!keyword) return -1;

  const close = skipSpaceBack(masked, before - keyword[0].length);
  return masked[close] === '}' ? enclosingOpen(masked, close, '{') : -1;
};

const isImport = (masked: string, index: number) => {
  const statementStart = Math.max(masked.lastIndexOf(';', index), 0);
  return /(?:^|\s)(?:import|export)\s*(?:type\s*)?\{[^}]*$/.test(masked.slice(statementStart, index));
};

const NAME = '[A-Za-z_$][\\w$]*';

const namesMatching = (masked: string, pattern: string) =>
  new Set([...masked.matchAll(new RegExp(pattern, 'g'))].map((match) => match[1] ?? ''));

const hostNames = (masked: string) => {
  const signals = new Set([
    ...namesMatching(
      masked,
      `(?<![\\w$.])(${NAME})\\s*[?!]?\\s*=\\s*(?:input|signal|computed|model)(?:\\.required)?\\s*<[^>;]*(?<![\\w$])${HOST}(?![\\w$\\[])`,
    ),
    ...namesMatching(
      masked,
      `(?<![\\w$.])(${NAME})\\s*[?!]?\\s*:\\s*(?:Input|Writable|Model)?Signal<[^>;]*(?<![\\w$])${HOST}(?![\\w$\\[])`,
    ),
  ]);
  const values = namesMatching(masked, `(?<![\\w$.])(${NAME})\\s*[?!]?\\s*:\\s*(?:readonly\\s+)?${HOST}(?![\\w$\\[])`);

  for (const local of masked.matchAll(
    new RegExp(`\\b(?:const|let|var)\\s+(${NAME})\\s*=\\s*(?:this\\.)?(${NAME})\\(\\s*\\)`, 'g'),
  )) {
    if (signals.has(local[2] ?? '')) values.add(local[1] ?? '');
  }

  return { signals, values };
};

const readsHost = (before: string, signals: Set<string>, values: Set<string>) => {
  const receiver = /(?<![\w$.])(?:this\.)?([A-Za-z_$][\w$]*)\s*(\(\s*\))?\s*!?\s*\??\.\s*$/.exec(before);
  if (!receiver) return false;

  return receiver[2] ? signals.has(receiver[1] ?? '') : values.has(receiver[1] ?? '');
};

export const migrateColumnVisibilityHost = (source: string, masked: string) => {
  const edits: Edit[] = [];
  const findings: Finding[] = [];
  const others: number[] = [];
  const covered = new Set<number>();

  for (const match of masked.matchAll(HOST_PATTERN)) {
    const index = match.index ?? 0;
    const open = literalOf(masked, index);

    if (open === -1) {
      if (!isImport(masked, index)) others.push(index);
      continue;
    }

    const close = matchForward(masked, open);
    const keys = splitTopLevel(masked, open + 1, close, ',').map(([start, end]) => {
      const keyStart = skipSpace(masked, start);
      return { keyStart, text: masked.slice(keyStart, end) };
    });

    const old = keys.find((key) => /^allColumns(?![\w$])/.test(key.text));
    if (!old) continue;

    if (keys.some((key) => /^availableColumns(?![\w$])/.test(key.text))) {
      covered.add(old.keyStart);
      findings.push(
        finding(
          source,
          old.keyStart,
          `This ${HOST} has both allColumns and availableColumns: remove allColumns, the host no longer reads it.`,
        ),
      );
      continue;
    }

    const shorthand = old.text.trim() === 'allColumns';

    edits.push({
      start: old.keyStart,
      end: old.keyStart + 'allColumns'.length,
      text: shorthand ? 'availableColumns: allColumns' : 'availableColumns',
    });
  }

  for (const edit of edits) covered.add(edit.start);

  const { signals, values } = hostNames(masked);

  for (const read of masked.matchAll(/(?<![\w$])allColumns(?![\w$])/g)) {
    const at = read.index ?? 0;
    if (covered.has(at)) continue;

    if (readsHost(masked.slice(0, at), signals, values)) {
      edits.push({ start: at, end: at + 'allColumns'.length, text: 'availableColumns' });
    } else if (others.length > 0) {
      findings.push(
        finding(source, at, `${HOST} has availableColumns instead of allColumns: rename this read or key by hand.`),
      );
    }
  }

  return { edits, findings };
};
