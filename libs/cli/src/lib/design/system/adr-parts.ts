import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const PARTS_LINE = /^parts:\s*\[([^\]]*)\]\s*$/m;
const BUILT_LINE = /^built:\s*\S+/m;

const frontmatterOf = (text: string) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';

/** The parts a decided ADR names in `parts: [<layer>/<name>]` and has not closed with `built: <sha>`. */
export const unbuiltAdrPartsOf = (text: string): string[] => {
  const front = frontmatterOf(text);
  const parts = PARTS_LINE.exec(front)?.[1];

  if (parts === undefined || BUILT_LINE.test(front)) return [];

  return parts
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

const adrDirsOf = (root: string) => {
  const apps = join(root, 'apps');
  const appDirs = existsSync(apps) ? readdirSync(apps).map((app) => join(apps, app, 'docs', 'adr')) : [];

  return [...appDirs, join(root, 'docs', 'adr')].filter((dir) => existsSync(dir));
};

/** Every part an ADR under `root` names with `parts` and no `built`, with the ADR file it comes from. */
export const planQuestionsOf = (root: string): { part: string; adr: string }[] =>
  adrDirsOf(resolve(root)).flatMap((dir) =>
    readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .sort()
      .flatMap((file) =>
        unbuiltAdrPartsOf(readFileSync(join(dir, file), 'utf8')).map((part) => ({
          part,
          adr: /^(\d{4})-/.exec(file)?.[1] ?? file,
        })),
      ),
  );
