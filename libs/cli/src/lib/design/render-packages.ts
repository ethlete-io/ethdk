import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

export const DEFAULT_RENDER_MODULES = ['@ethlete/components'];

export type RenderWorkerData = { target: string; packages: Record<string, string>; modules: string[] };

export type RenderRequest = { id: number; template: string; imports: string[]; providers: string | null };

export type RenderResult = { markup: string; styles: string[] } | { error: string };

export type RenderResponse = RenderResult & { id: number; watched: Record<string, number> };

export type MappedPackage = { dir: string; subpath: string };

const packageNameLength = (specifier: string) => {
  const segments = specifier.split('/');

  return (specifier.startsWith('@') ? segments.slice(0, 2) : segments.slice(0, 1)).join('/').length;
};

/**
 * The checkout folder a bare specifier is mapped to by `render.packages`, and the export subpath
 * inside it. `@ethlete/*` → `dist/libs/*` maps `@ethlete/core/design` to `dist/libs/core` and `./design`.
 */
export const mapPackage = (options: {
  specifier: string;
  packages: Record<string, string>;
  target: string;
}): MappedPackage | null => {
  const { specifier, packages, target } = options;
  const nameLength = packageNameLength(specifier);
  const name = specifier.slice(0, nameLength);
  const subpath = `.${specifier.slice(nameLength)}`;

  for (const [pattern, path] of Object.entries(packages)) {
    if (pattern === name) return { dir: resolve(target, path), subpath };

    if (pattern.endsWith('*') && name.startsWith(pattern.slice(0, -1))) {
      const rest = name.slice(pattern.length - 1);

      if (rest !== '' && !rest.includes('/')) return { dir: resolve(target, path.replace('*', rest)), subpath };
    }
  }

  return null;
};

type ExportTarget = string | null | ExportTarget[] | { [condition: string]: ExportTarget };

const CONDITIONS = ['node', 'import', 'default'];

const pick = (value: ExportTarget | undefined): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(pick).find((found) => found !== null) ?? null;
  if (!value) return null;

  for (const condition of CONDITIONS) {
    const found = pick(value[condition]);

    if (found) return found;
  }

  return null;
};

const exportOf = (exports: Record<string, ExportTarget>, subpath: string) => {
  if (subpath in exports) return pick(exports[subpath]);

  for (const [key, value] of Object.entries(exports)) {
    const [prefix, suffix, extra] = key.split('*');

    if (prefix === undefined || suffix === undefined || extra !== undefined) continue;
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue;

    const found = pick(value);
    const star = subpath.slice(prefix.length, subpath.length - suffix.length);

    if (found) return found.replace('*', star);
  }

  return null;
};

/** The file a mapped package exports at its subpath, read from its own `package.json` exports. */
export const entryOf = (mapped: MappedPackage) => {
  const { dir, subpath } = mapped;
  const manifestPath = resolve(dir, 'package.json');

  if (!existsSync(manifestPath)) {
    throw new Error(`design-explore: ${dir} has no package.json - build the package first.`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    exports?: Record<string, ExportTarget>;
    module?: string;
    main?: string;
  };
  const exported = manifest.exports ? exportOf(manifest.exports, subpath) : null;
  const fallback = subpath === '.' ? (manifest.module ?? manifest.main ?? null) : null;
  const file = exported ?? fallback;

  if (!file) throw new Error(`design-explore: ${dir} exports no "${subpath}".`);

  return resolve(dir, file);
};

/** The values behind the names a call imports, each from the first module that exports it. */
export const lookupImports = (options: { names: string[]; modules: Record<string, Record<string, unknown>> }) => {
  const { names, modules } = options;

  return names.map((name) => {
    const found = Object.values(modules).find((exported) => name in exported);

    if (!found) {
      throw new Error(`design-explore: no import "${name}" in ${Object.keys(modules).join(', ')}.`);
    }

    return found[name];
  });
};

/**
 * The inner markup of the render host followed by what the app attached to `<body>` after it (an
 * open overlay, shown: positioning never runs on the server), and the text of every `<style>` tag.
 */
export const extractRender = (document: string) => {
  const host = /<et-design-host[^>]*>([\s\S]*)<\/et-design-host>([\s\S]*?)<\/body>/.exec(document);
  const attached = (host?.[2] ?? '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/(class="[^"]*?)\s*\bet-force-invisible\b/g, '$1');
  const markup = (host?.[1] ?? '') + attached.trim();
  const styles = [...document.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1] ?? '');

  return { markup: markup.replace(/<!--container-->/g, ''), styles };
};

const typesOf = (dir: string) => {
  const manifestPath = resolve(dir, 'package.json');

  if (!existsSync(manifestPath)) return null;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    exports?: Record<string, { types?: string }>;
    types?: string;
    typings?: string;
  };
  const types = manifest.exports?.['.']?.types ?? manifest.types ?? manifest.typings;

  return types ? resolve(dir, types) : null;
};

const readdirSafe = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []);

/**
 * The tsconfig `paths` that type a mapped package's root import from the folder `ng()` loads it
 * from. Only the root: a subpath keeps resolving the way the checkout resolves it.
 */
export const typePathsOf = (options: { packages: Record<string, string>; target: string }) => {
  const { packages, target } = options;
  const paths: Record<string, string[]> = {};

  for (const [pattern, path] of Object.entries(packages)) {
    const names: [string, string][] = pattern.endsWith('*')
      ? readdirSafe(resolve(target, path.slice(0, path.indexOf('*')))).map((name) => [
          pattern.replace('*', name),
          resolve(target, path.replace('*', name)),
        ])
      : [[pattern, resolve(target, path)]];

    for (const [name, dir] of names) {
      const types = typesOf(dir);

      if (types) paths[name] = [types];
    }
  }

  return paths;
};
