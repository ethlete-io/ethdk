import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import postcss from 'postcss';
import { ProductSource } from './base';

const importedFilesOf = (file: string) => {
  const files: string[] = [];

  try {
    postcss.parse(readFileSync(file, 'utf8')).walkAtRules('import', (rule) => {
      const specifier = /^(?:url\(\s*)?['"]?([^'"\s)]+)/u.exec(rule.params.trim())?.[1];

      if (specifier?.startsWith('.')) files.push(resolve(dirname(file), specifier));
    });
  } catch {
    return [];
  }

  return files;
};

/** The product's stylesheets and every file they reach through a relative `@import`, each resolved. */
export const productStylesheetFilesOf = (source: ProductSource) => {
  const root = resolve(dirname(source.configFile), '../..');
  const queue = (source.config.styles ?? []).map((style) => resolve(root, style));
  const seen = new Set<string>();

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (seen.has(file) || !existsSync(file)) continue;

    seen.add(file);
    queue.push(...importedFilesOf(file));
  }

  return seen;
};
