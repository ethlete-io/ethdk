import { globSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const exclude = (path) => path === 'node_modules' || path === 'dist' || path === '.git' || path === 'tmp';

export const vitestConfigs = (root = '.') => {
  const configs = globSync('**/{vite,vitest}.config.{mjs,js,ts,mts}', { cwd: root, exclude });
  const vitestDirs = new Set(configs.filter((path) => /(^|\/)vitest\.config\./.test(path)).map(dirname));

  return configs.filter((path) => /(^|\/)vitest\.config\./.test(path) || !vitestDirs.has(dirname(path)));
};

export const workerProblemsOf = (path, source) => {
  if (!/\btest:\s*\{/.test(source) || /\bbrowser:\s*\{/.test(source) || /fileParallelism:\s*false/.test(source)) {
    return [];
  }

  if (/maxWorkers:\s*specWorkers\b/.test(source) && /from\s+['"][./]*tools\/vitest\/workers(\.mts)?['"]/.test(source)) {
    return [];
  }

  return [
    `${path} runs vitest without \`maxWorkers: specWorkers\` from tools/vitest/workers.mts. The worker count follows the core count, so a big Mac starts a fork per core and timing specs time out where CI (about 3 workers) passes.`,
  ];
};

if (import.meta.main) {
  const problems = vitestConfigs().flatMap((path) => workerProblemsOf(path, readFileSync(path, 'utf8')));

  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
