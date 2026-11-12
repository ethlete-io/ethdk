import { globSync } from 'node:fs';
import { dirname } from 'node:path';
import { defineConfig } from 'vitest/config';

const configs = globSync('**/{vite,vitest}.config.{mjs,js,ts,mts}', {
  exclude: (path) =>
    path === 'vitest.config.mjs' || path === 'node_modules' || path === 'dist' || path === '.git' || path === 'tmp',
});
const vitestDirs = new Set(configs.filter((path) => /(^|\/)vitest\.config\./.test(path)).map(dirname));

export default defineConfig({
  test: {
    projects: configs.filter((path) => /(^|\/)vitest\.config\./.test(path) || !vitestDirs.has(dirname(path))),
  },
});
