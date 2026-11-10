import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unpaddedLength, wideCells } from './plan-size.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const PLAN_FILES = ['plans/ethlete-studio/design-to-code.md', 'plans/ethlete-studio/STATUS.md'];

export const budgetFor = (file, config) => {
  if (config.overrides?.[file] !== undefined) return config.overrides[file];
  return config.groups.find((group) => group.files?.includes(file))?.budget;
};

const cellCapFor = (file, config) => config.groups.find((group) => group.files?.includes(file))?.cellCap;

export const checkStagedPlans = async ({ files, read, config, isFormatted }) => {
  const problems = [];

  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const source = read(file);
    const isPlan = PLAN_FILES.includes(file);
    const budget = isPlan ? budgetFor(file, config) : undefined;

    const size = unpaddedLength(source);
    const cap = isPlan ? cellCapFor(file, config) : undefined;

    if (budget !== undefined && size > budget) {
      problems.push(
        `${file}: ${size} chars without table padding exceeds the budget of ${budget}. Archive findings or shrink it.`,
      );
    }

    for (const { row, length } of cap === undefined ? [] : wideCells(source, cap)) {
      problems.push(`${file}: row ${row} has a ${length}-char cell, over the cap of ${cap}. Shorten it.`);
    }

    if (!(await isFormatted(file, source))) {
      problems.push(`${file}: not formatted (run \`npx prettier --write ${file}\` and stage it).`);
    }
  }

  return problems;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(here, '../..');
  const files = process.argv.slice(2).filter((f) => f.endsWith('.md'));

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
        const info = await prettier.getFileInfo(filepath, { ignorePath: join(root, '.prettierignore') });
        if (info.ignored || !info.inferredParser) return true;
        const options = { ...(await prettier.resolveConfig(filepath)), filepath };
        return prettier.check(source, options);
      },
    });

    problems.forEach((problem) => console.error(problem));
    if (problems.length > 0) process.exit(1);
  }
}
