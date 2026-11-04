import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LABELS_PATH = 'apps/ethlete-studio/src/app/i18n/studio-labels.ts';
const SPEC_GLOB = 'apps/ethlete-studio/**/*.spec.ts';
const MIN_LENGTH = 6;
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g;

const git = (...args) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

export const literalsOf = (line) =>
  [...line.matchAll(LITERAL)]
    .flatMap((match) => (match[1] ?? match[2] ?? match[3]).split(/\$\{[^}]*\}/))
    .map((text) => text.trim())
    .filter((text) => text.length >= MIN_LENGTH);

export const removedLiterals = (diff, headText) =>
  [
    ...new Set(
      diff
        .split('\n')
        .filter((line) => line.startsWith('-') && !line.startsWith('---'))
        .flatMap((line) => literalsOf(line.slice(1))),
    ),
  ].filter((text) => !headText.includes(text));

export const staleSpecHits = (literals, grep) =>
  literals.flatMap((literal) => grep(literal).map((hit) => ({ literal, hit })));

const main = () => {
  const base = process.env.NX_BASE;
  const head = process.env.NX_HEAD ?? 'HEAD';
  if (!base) return 0;

  const diff = git('diff', '-U0', base, head, '--', LABELS_PATH).stdout ?? '';
  if (!diff) return 0;

  const headText = git('show', `${head}:${LABELS_PATH}`).stdout ?? '';
  const hits = staleSpecHits(removedLiterals(diff, headText), (literal) =>
    git('grep', '-n', '-F', '-e', literal, head, '--', SPEC_GLOB)
      .stdout.split('\n')
      .filter(Boolean)
      .map((line) => line.slice(head.length + 1)),
  );

  for (const { literal, hit } of hits)
    console.error(`studio-label-specs: ${hit.slice(0, 160)}\n  asserts removed label text "${literal}"`);
  return hits.length ? 1 : 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
