import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { callsRootOf } from './paths';

const OPENING = /defineCall\(\{\n/;
const DECLARES = /^\s*(stage|legacy)\s*:/m;

const callFilesOf = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);

    if (statSync(path).isDirectory()) return callFilesOf(path);

    return name === 'call.ts' ? [path] : [];
  });

/**
 * Writes `legacy: true` into every call of a project that declares no stage, so `et design check`
 * accepts the calls made before the stage was required. A call that declares one stays untouched.
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

    if (DECLARES.test(text)) continue;

    if (!OPENING.test(text)) {
      unreadable.push(relative(target, path));
      continue;
    }

    writeFileSync(
      path,
      text.replace(OPENING, (opening) => `${opening}  legacy: true,\n`),
    );
    console.log(`legacy ${relative(target, path)}`);
    marked++;
  }

  for (const path of unreadable) {
    console.error(`SKIPPED ${path} - no "defineCall({" line. Add legacy: true by hand.`);
  }

  console.log(`ok ${marked} call${marked === 1 ? '' : 's'} marked legacy in ${project}`);

  return unreadable.length > 0 ? 1 : 0;
};
