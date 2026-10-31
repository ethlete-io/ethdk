import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const expand = (root, group) => {
  if (group.files) return group.files;
  const file = group.glob.split('/').pop();
  const base = join(root, '.agents/skills');
  if (!existsSync(base)) return [];
  return readdirSync(base).map((name) => `.agents/skills/${name}/${file}`);
};

export const checkSizeBudget = (root, config) => {
  const failures = [];
  for (const group of config.groups) {
    for (const file of expand(root, group)) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      const budget = config.overrides?.[file] ?? group.budget;
      const size = readFileSync(path, 'utf8').length;
      if (size > budget) failures.push({ file, size, budget, group: group.name });
    }
  }
  return failures;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(here, '../..');
  const config = JSON.parse(readFileSync(join(here, 'size-budget.json'), 'utf8'));
  const failures = checkSizeBudget(root, config);
  for (const f of failures) {
    console.error(
      `${f.file}: ${f.size} chars exceeds the ${f.group} budget of ${f.budget}. Shrink it or move detail into a linked file.`,
    );
  }
  if (failures.length) process.exit(1);
  console.log('size budgets ok');
}
