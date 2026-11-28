import { existsSync, realpathSync } from 'fs';
import { dirname, resolve } from 'path';
import { AtRule, Message, Plugin } from 'postcss';

const RELATIVE_PATH = /(['"])(\.{1,2}(?:\/[^'"]*)?)\1/u;

// Workaround: Tailwind's oxide scanner applies no .gitignore to a source path that runs through a symlink, and then
// reads every ignored build tree below it.
const realIn = (dir: string, path: string) => {
  const absolute = resolve(dir, path);

  return existsSync(absolute) ? realpathSync(absolute) : absolute;
};

const absoluteIn = (params: string, dir: string) =>
  params.replace(RELATIVE_PATH, (...[, quote = '', path = '']: string[]) => `${quote}${realIn(dir, path)}${quote}`);

const importersOf = (messages: Message[]) => {
  const importers = new Map<string, Set<string>>();

  for (const message of messages) {
    if (message.type !== 'dependency' || typeof message['file'] !== 'string' || typeof message['parent'] !== 'string')
      continue;

    const file = resolve(message['file']);

    importers.set(file, (importers.get(file) ?? new Set<string>()).add(resolve(message['parent'])));
  }

  return importers;
};

/**
 * A PostCSS plugin that makes each relative `@source` path and each `source()` of an `@import`
 * absolute, against the stylesheet that wrote it. Tailwind resolves both against the entry stylesheet once
 * postcss-import has inlined the imports, so it must run after the inlining and before Tailwind.
 */
export const importedSourcesPlugin = (): Plugin => ({
  postcssPlugin: 'ethlete-imported-sources',
  Once: (root, { result }) => {
    const importers = importersOf(result.messages);
    const fileOf = (rule: AtRule) => {
      const file = rule.source?.input.file;

      return file ? resolve(file) : null;
    };

    root.walkAtRules('source', (rule) => {
      const file = fileOf(rule);

      if (file && !rule.params.startsWith('inline(')) rule.params = absoluteIn(rule.params, dirname(file));
    });

    root.walkAtRules('media', (rule) => {
      const file = fileOf(rule);
      const [importer, ...others] = file ? [...(importers.get(file) ?? [])] : [];

      if (!importer || others.length > 0) return;

      rule.params = rule.params.replace(/source\(([^)]*)\)/u, (source, path: string) =>
        RELATIVE_PATH.test(path) ? `source(${absoluteIn(path, dirname(importer))})` : source,
      );
    });
  },
});
