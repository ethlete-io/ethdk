import { existsSync, readFileSync } from 'fs';
import { createJiti } from 'jiti';
import { resolve } from 'path';
import { git } from '../git-reader';
import { DesignConfig } from '../design-config';
import { mapPackage, renderPackagesOf } from '../render-packages';

type TailwindThemeNames = object;

type RenameEngine = {
  migrateThemeTokenNames: (content: string, names?: TailwindThemeNames) => { content: string };
  collectTailwindThemeNames: (content: string, into: TailwindThemeNames) => TailwindThemeNames;
  emptyTailwindThemeNames: () => TailwindThemeNames;
  isGeneratedThemeFile: (content: string) => boolean;
};

const ENGINE = 'generators/migrate-theme-token-names/theme-token-names';

const engines = new Map<string, RenameEngine | null>();

const loadEngine = (file: string): RenameEngine | null => {
  try {
    return createJiti(__filename)(file) as RenameEngine;
  } catch {
    return null;
  }
};

const cssFilesOf = (target: string) => {
  try {
    return git(['ls-files', '-z', '--', '*.css'], { cwd: target, stdio: 'pipe' })
      .split('\0')
      .filter((file) => file !== '');
  } catch {
    return [];
  }
};

const engineIn = (dir: string): RenameEngine | null => {
  const cached = engines.get(dir);

  if (cached !== undefined) return cached;

  const file = ['.js', '.ts'].map((extension) => resolve(dir, `${ENGINE}${extension}`)).find(existsSync);
  const engine = file ? loadEngine(file) : null;

  engines.set(dir, engine);

  return engine;
};

const themeNamesOf = (target: string, engine: RenameEngine) => {
  const names = engine.emptyTailwindThemeNames();

  for (const file of cssFilesOf(target)) {
    const path = resolve(target, file);
    const content = existsSync(path) ? readFileSync(path, 'utf8') : '';

    if (engine.isGeneratedThemeFile(content)) engine.collectTailwindThemeNames(content, names);
  }

  return names;
};

const layoutOf = (content: string) =>
  content
    .replace(/\s+/g, ' ')
    .replace(/ ?([(),]) ?/g, '$1')
    .trim();

/**
 * Whether `now` is `old` with the theming revision's old theme tokens renamed, as the `migrate-theme-token-names` engine
 * of the checkout's `@ethlete/core` (the one `render.packages` maps, else `node_modules`) renames them, up to the line
 * breaks and spaces a formatter changes; null when the checkout has no engine.
 */
export const themeTokenRenameOf = (options: {
  target: string;
  config: DesignConfig | null;
}): ((old: string, now: string) => boolean) | null => {
  const { target, config } = options;
  const mapped = mapPackage({ specifier: '@ethlete/core', packages: renderPackagesOf({ target, config }), target });
  const engine = [...(mapped ? [mapped.dir] : []), resolve(target, 'node_modules/@ethlete/core')]
    .map(engineIn)
    .find((found) => found !== null);

  if (!engine) return null;

  let names: TailwindThemeNames | null = null;

  return (old, now) => {
    names ??= themeNamesOf(target, engine);

    return layoutOf(engine.migrateThemeTokenNames(old, names).content) === layoutOf(now);
  };
};
