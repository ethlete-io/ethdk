import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const PLAN_FILES = ['plans/ethlete-studio/design-to-code.md', 'plans/ethlete-studio/STATUS.md'];

export const budgetFor = (file, config) => {
  if (config.overrides?.[file] !== undefined) return config.overrides[file];
  return config.groups.find((group) => group.files?.includes(file))?.budget;
};

export const checkStagedPlans = async ({ files, read, config, isFormatted }) => {
  const problems = [];

  for (const file of files.filter((f) => PLAN_FILES.includes(f))) {
    const source = read(file);
    const budget = budgetFor(file, config);

    if (budget !== undefined && source.length > budget) {
      problems.push(`${file}: ${source.length} chars exceeds the budget of ${budget}. Archive findings or shrink it.`);
    }

    if (!(await isFormatted(file, source))) {
      problems.push(`${file}: not formatted (run \`npx prettier --write ${file}\` and stage it).`);
    }
  }

  return problems;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(here, '../..');
  const files = process.argv.slice(2).filter((f) => PLAN_FILES.includes(f));

  if (files.length > 0) {
    const prettier = await import('prettier');
    const config = JSON.parse(readFileSync(join(here, 'size-budget.json'), 'utf8'));
    const problems = await checkStagedPlans({
      files,
      config,
      read: (file) =>
        execFileSync('git', ['show', `:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }),
      isFormatted: async (file, source) => {
        const filepath = resolve(root, file);
        const options = { ...(await prettier.resolveConfig(filepath)), filepath };
        return prettier.check(source, options);
      },
    });

    problems.forEach((problem) => console.error(problem));
    if (problems.length > 0) process.exit(1);
  }
}
