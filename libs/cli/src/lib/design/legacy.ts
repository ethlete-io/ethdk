import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { callFilesOf } from './calls';
import { callsRootOf } from './paths';

const OPENING = /defineCall\(\{\n/;
const HAS_STAGE = /^\s*stage\s*:/m;
const HAS_LEGACY = /^\s*legacy\s*:/m;
const HAS_TRANSFERRED = /^\s*transferred\s*:/m;
const LEGACY_LINE = /^([ \t]*)legacy\s*:\s*true,?[ \t]*\n/m;

const STAGE_OF_GROUP: Record<string, string> = { foundations: 'themes', components: 'component', pages: 'page' };

/**
 * Writes `legacy: true` into every call of a project that declares no stage, plus the stage its
 * group folder implies (foundations, components, pages), so `et design check` accepts the calls
 * made before the stage was required. A legacy call without a stage gets one on a rerun; a stage
 * already declared is never changed.
 */
export const markLegacy = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const project = argv.find((argument) => !argument.startsWith('--'));

  if (!project) {
    console.error(`usage: ${invocation} legacy <project>`);

    return 2;
  }

  const folder = join(callsRootOf(target), project);

  if (!existsSync(folder)) {
    console.error(`NO PROJECT "${project}" - ${relative(target, folder)} does not exist.`);

    return 1;
  }

  const unreadable: string[] = [];
  let marked = 0;

  for (const path of callFilesOf(folder)) {
    const text = readFileSync(path, 'utf8');

    if (HAS_STAGE.test(text)) continue;

    const group = relative(folder, path).split(sep)[0] ?? '';
    const stage = relative(folder, path).split(sep).length > 2 ? (STAGE_OF_GROUP[group] ?? null) : null;
    const isLegacy = HAS_LEGACY.test(text);

    if (isLegacy && !stage) continue;

    if (isLegacy ? !LEGACY_LINE.test(text) : !OPENING.test(text)) {
      unreadable.push(relative(target, path));
      continue;
    }

    const stageLine = (indent: string) => (stage ? `${indent}stage: '${stage}',\n` : '');

    writeFileSync(
      path,
      isLegacy
        ? text.replace(LEGACY_LINE, (line, indent: string) => `${line}${stageLine(indent)}`)
        : text.replace(OPENING, (opening) => `${opening}  legacy: true,\n${stageLine('  ')}`),
    );
    console.log(`legacy ${relative(target, path)}${stage ? ` (stage ${stage})` : ''}`);
    marked++;
  }

  for (const path of unreadable) {
    console.error(`SKIPPED ${path} - no "defineCall({" line. Add legacy: true by hand.`);
  }

  console.log(`ok ${marked} call${marked === 1 ? '' : 's'} marked legacy in ${project}`);

  return unreadable.length > 0 ? 1 : 0;
};

export const TRANSFER_PATH = '/__design/transfer';

export type TransferResult = 'marked' | 'already' | 'missing' | 'unreadable';

/** Writes `transferred: true` into a call's `call.ts`, below its `legacy: true` line when it has one. */
export const markTransferred = (options: { target: string; slug: string }): TransferResult => {
  const path = join(callsRootOf(options.target), options.slug, 'call.ts');

  if (!options.slug || options.slug.split(/[\\/]/).includes('..') || !existsSync(path)) return 'missing';

  const text = readFileSync(path, 'utf8');

  if (HAS_TRANSFERRED.test(text)) return 'already';

  if (LEGACY_LINE.test(text)) {
    writeFileSync(
      path,
      text.replace(LEGACY_LINE, (line, indent: string) => `${line}${indent}transferred: true,\n`),
    );

    return 'marked';
  }

  if (!OPENING.test(text)) return 'unreadable';

  writeFileSync(
    path,
    text.replace(OPENING, (opening) => `${opening}  transferred: true,\n`),
  );

  return 'marked';
};
