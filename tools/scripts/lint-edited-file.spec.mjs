import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { lintTargetOf } from './lint-edited-file.mjs';

const root = resolve(import.meta.dirname, '../..');
const input = (file_path) => ({ tool_name: 'Edit', tool_input: { file_path } });
const always = () => true;

test('lints a ts, mjs or js file under libs or apps in its project dir', () => {
  assert.deepEqual(lintTargetOf(input(`${root}/libs/cli/src/index.ts`), always), {
    dir: 'libs/cli',
    file: 'src/index.ts',
  });
  assert.deepEqual(lintTargetOf(input('apps/ethlete-studio/e2e/canvas.e2e.mjs'), always), {
    dir: 'apps/ethlete-studio',
    file: 'e2e/canvas.e2e.mjs',
  });
});

test('skips other files, other folders, projects without a config and inputs without a path', () => {
  assert.equal(lintTargetOf(input(`${root}/libs/cli/README.md`), always), undefined);
  assert.equal(lintTargetOf(input(`${root}/tools/scripts/x.mjs`), always), undefined);
  assert.equal(lintTargetOf(input('/tmp/libs/cli/x.ts'), always), undefined);
  assert.equal(
    lintTargetOf(input(`${root}/libs/cli/src/index.ts`), () => false),
    undefined,
  );
  assert.equal(lintTargetOf({ tool_name: 'Bash', tool_input: { command: 'ls' } }, always), undefined);
});
