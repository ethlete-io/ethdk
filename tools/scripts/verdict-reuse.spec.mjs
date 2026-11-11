import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verdictBelow } from './verdict-reuse.mjs';

const above = (...files) => [
  { sha: 'top', files },
  { sha: 'green', files: ['libs/cli/src/index.ts'] },
];

test('only the docs allowlist sits above a reused verdict', () => {
  for (const file of [
    'plans/ethlete-studio/STATUS.md',
    'apps/ethlete-studio/docs/adr/0230-a.md',
    '.changeset/a.md',
    '.claude/handoffs/builder.md',
    '.agents/skills/builder-agent/references/push.md',
  ])
    assert.deepEqual(
      verdictBelow(above(file), (sha) => sha === 'green'),
      { sha: 'green', onTop: 1 },
      file,
    );
  for (const file of [
    'apps/ethlete-studio/docs/adr/nested/0001-a.md',
    'apps/ethlete-studio/docs/README.md',
    '.changeset/config.json',
    '.agents/skills/builder-agent/run.mjs',
    'apps/docs/index.md',
  ])
    assert.deepEqual(
      verdictBelow(above(file), (sha) => sha === 'green'),
      { blocker: 'top', file },
      file,
    );
});

test('a verdict on the newest commit needs no walk', () => {
  assert.deepEqual(
    verdictBelow(above('tools/x.mjs'), (sha) => sha === 'top'),
    { sha: 'top', onTop: 0 },
  );
});
