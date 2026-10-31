import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSizeBudget } from './check-size-budget.mjs';

const config = {
  groups: [
    { name: 'AGENTS.md', files: ['AGENTS.md'], budget: 10 },
    { name: 'skill', glob: '.agents/skills/*/SKILL.md', budget: 10 },
  ],
  overrides: { '.agents/skills/big/SKILL.md': 50 },
};

test('flags files over budget and honours per-file overrides', () => {
  const root = mkdtempSync(join(tmpdir(), 'size-budget-'));
  writeFileSync(join(root, 'AGENTS.md'), 'x'.repeat(11));
  for (const [name, n] of [
    ['small', 5],
    ['huge', 11],
    ['big', 40],
  ]) {
    mkdirSync(join(root, '.agents/skills', name), { recursive: true });
    writeFileSync(join(root, '.agents/skills', name, 'SKILL.md'), 'x'.repeat(n));
  }
  const failed = checkSizeBudget(root, config)
    .map((f) => f.file)
    .sort();
  assert.deepEqual(failed, ['.agents/skills/huge/SKILL.md', 'AGENTS.md']);
});
