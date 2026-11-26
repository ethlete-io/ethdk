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

export const migrateColumnVisibilityHost = (source: string, masked: string) => {
  const edits: Edit[] = [];
  const findings: Finding[] = [];
  const others: number[] = [];

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

  if (others.length > 0 && /(?<![\w$])allColumns(?![\w$])/.test(source)) {
    for (const index of others) {
      findings.push(
        finding(
          source,
          index,
          `${HOST} has availableColumns instead of allColumns: rename what this file reads or supplies by hand.`,
        ),
      );
    }
  }

  return { edits, findings };
};
