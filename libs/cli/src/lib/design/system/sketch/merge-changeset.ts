import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { noteWrite } from '../write-journal';
import { join, relative, sep } from 'path';

type WorkspacePackage = { dir: string; name: string };

const jsonOf = (file: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const nameOf = (dir: string) => {
  const name = jsonOf(join(dir, 'package.json'))?.['name'];

  return typeof name === 'string' && name.length > 0 ? name : null;
};

const patternsOf = (root: Record<string, unknown>) => {
  const workspaces = root['workspaces'];
  const list = Array.isArray(workspaces)
    ? workspaces
    : typeof workspaces === 'object' && workspaces !== null
      ? (workspaces as { packages?: unknown }).packages
      : undefined;

  return Array.isArray(list) ? list.filter((pattern): pattern is string => typeof pattern === 'string') : null;
};

const dirsOfPattern = (top: string, pattern: string) => {
  const clean = pattern.replace(/^\.\//, '').replace(/\/$/, '');

  if (!clean.endsWith('/*')) return [clean];

  const parent = clean.slice(0, -2);

  if (!existsSync(join(top, parent))) return [];

  return readdirSync(join(top, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${parent}/${entry.name}`);
};

const packagesOf = (top: string): WorkspacePackage[] => {
  const root = jsonOf(join(top, 'package.json'));

  if (!root) return [];

  const patterns = patternsOf(root);

  if (!patterns) return typeof root['name'] === 'string' ? [{ dir: '', name: root['name'] }] : [];

  const ignored = jsonOf(join(top, '.changeset', 'config.json'))?.['ignore'];

  return patterns
    .flatMap((pattern) => dirsOfPattern(top, pattern))
    .flatMap((dir) => {
      const name = nameOf(join(top, dir));

      return name ? [{ dir: `${dir}/`, name }] : [];
    })
    .filter(({ name }) => !(Array.isArray(ignored) && ignored.includes(name)));
};

/** The names of the workspace packages of the checkout at `top` that hold any of `files` (absolute paths). */
export const changedPackagesOf = (options: { top: string; files: string[] }) => {
  const packages = packagesOf(options.top);
  const paths = options.files.map((file) => relative(options.top, file).split(sep).join('/'));

  return [
    ...new Set(
      paths.flatMap((path) =>
        packages
          .filter(({ dir }) => dir === '' || path.startsWith(dir))
          .sort((a, b) => b.dir.length - a.dir.length)
          .slice(0, 1)
          .map(({ name }) => name),
      ),
    ),
  ].sort();
};

/**
 * Writes a changeset that names each workspace package holding one of `files` with the level `none`, so a merge commit
 * passes a changeset coverage check on its own. Answers the file written, or `null` when the checkout has no
 * `.changeset` folder or no file lies in a package.
 */
export const writeMergeChangeset = (options: { top: string; files: string[]; slug: string }) => {
  const dir = join(options.top, '.changeset');

  if (!existsSync(dir)) return null;

  const packages = changedPackagesOf(options);

  if (packages.length === 0) return null;

  const base = `design-merge-${options.slug
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()}`;
  let file = join(dir, `${base}.md`);

  for (let n = 2; existsSync(file); n++) file = join(dir, `${base}-${n}.md`);

  noteWrite(file);
  writeFileSync(file, `---\n${packages.map((name) => `'${name}': none`).join('\n')}\n---\n`);

  return file;
};
