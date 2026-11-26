import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, join, matchesGlob } from 'node:path';

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

  if (/maxWorkers:\s*specWorkers\b/.test(source) && /from\s+['"][./]*tools\/vitest\/workers\.mjs['"]/.test(source)) {
    return [];
  }

  return [
    `${path} runs vitest without \`maxWorkers: specWorkers\` from tools/vitest/workers.mjs. The worker count follows the core count, so a big Mac starts a fork per core and timing specs time out where CI (about 3 workers) passes.`,
  ];
};

const projectRootOf = (path, root) => {
  for (let dir = dirname(path); dir !== '.'; dir = dirname(dir)) {
    if (existsSync(join(root, dir, 'project.json'))) return dir;
  }

  return undefined;
};

const inferredTestTarget = (path, nxJson) =>
  (nxJson.plugins ?? []).some((entry) => {
    const plugin = typeof entry === 'string' ? { plugin: entry } : entry;

    return (
      plugin.plugin === '@nx/vitest' &&
      (plugin.options?.testTargetName ?? 'test') === 'test' &&
      (!plugin.include || plugin.include.some((glob) => matchesGlob(path, glob))) &&
      !(plugin.exclude ?? []).some((glob) => matchesGlob(path, glob))
    );
  });

export const testTargetProblemsOf = (path, source, root = '.') => {
  if (!/\btest:\s*\{/.test(source) || /\bbrowser:\s*\{/.test(source)) return [];

  const projectRoot = projectRootOf(path, root);
  const project = projectRoot && JSON.parse(readFileSync(join(root, projectRoot, 'project.json'), 'utf8'));
  const nxJson = JSON.parse(readFileSync(join(root, 'nx.json'), 'utf8'));

  if (project?.targets?.test || inferredTestTarget(path, nxJson)) return [];

  return [
    `${path} has no \`test\` target in ${projectRoot ? `${projectRoot}/project.json` : 'any project'} and is not inferred by the @nx/vitest plugin in nx.json, so \`nx run-many -t test\` in CI never runs its specs. Add a \`test\` target that runs it. Only browser-mode configs are exempt: they need a browser and run through their own named target.`,
  ];
};

if (import.meta.main) {
  const problems = vitestConfigs().flatMap((path) => {
    const source = readFileSync(path, 'utf8');

    return [...workerProblemsOf(path, source), ...testTargetProblemsOf(path, source)];
  });

  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
