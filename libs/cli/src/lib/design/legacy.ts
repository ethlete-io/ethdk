import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { callsRootOf } from './paths';

const OPENING = /defineCall\(\{\n/;
const HAS_STAGE = /^\s*stage\s*:/m;
const HAS_LEGACY = /^\s*legacy\s*:/m;
const LEGACY_LINE = /^([ \t]*)legacy\s*:\s*true,?[ \t]*\n/m;

const STAGE_OF_GROUP: Record<string, string> = { foundations: 'themes', components: 'component', pages: 'page' };

const callFilesOf = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);

    if (statSync(path).isDirectory()) return callFilesOf(path);

    return name === 'call.ts' ? [path] : [];
  });

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
