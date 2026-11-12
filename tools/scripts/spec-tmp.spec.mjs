import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { withStepTmp } from './push-suite.mjs';
import { isCountedTmpName, leakMessageOf, openSpecTmp } from './spec-tmp.mjs';

const hook = join(import.meta.dirname, 'spec-tmp-hook.mjs');
const fixtures = mkdtempSync(join(tmpdir(), 'spec-tmp-spec-'));

after(() => rmSync(fixtures, { recursive: true, force: true }));

const runSpec = (name, body) => {
  const file = join(fixtures, name);

  writeFileSync(
    file,
    `import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';\nimport { tmpdir } from 'node:os';\nimport { join } from 'node:path';\nimport { it } from 'node:test';\nit('runs', () => {\n${body}\n});\n`,
  );

  const env = { ...process.env, TMPDIR: fixtures };

  delete env['NODE_TEST_CONTEXT'];

  return spawnSync(process.execPath, ['--import', hook, '--test', file], { cwd: fixtures, env, encoding: 'utf8' });
};

describe('openSpecTmp', () => {
  it('lists what a run left and removes its dir', () => {
    const tmp = openSpecTmp(fixtures);

    mkdirSync(join(tmp.dir, 'adr-abc123'));
    mkdirSync(join(tmp.dir, 'yarn--1-2'));
    mkdirSync(join(tmp.dir, 'xfs-1234'));
    mkdirSync(join(tmp.dir, 'node-compile-cache'));

    assert.deepEqual(tmp.close(), ['adr-abc123']);
    assert.equal(existsSync(tmp.dir), false);
  });

  it('links the kept caches of the parent and keeps them', () => {
    mkdirSync(join(fixtures, 'et-design-harness-cache'), { recursive: true });
    const tmp = openSpecTmp(fixtures);

    writeFileSync(join(tmp.dir, 'et-design-harness-cache', 'entry'), '');

    assert.deepEqual(tmp.close(), []);
    assert.equal(existsSync(join(fixtures, 'et-design-harness-cache', 'entry')), true);
  });

  it('never counts caches, yarn and Claude Code folders', () => {
    for (const name of [
      'node-compile-cache',
      'et-design-harness-cache',
      'jest_rs',
      'yarn--17-0.5',
      'xfs-ab12',
      'claude-1000',
    ])
      assert.equal(isCountedTmpName(name), false, name);
    assert.equal(isCountedTmpName('tmp-123-abc'), true);
  });

  it('names the spec relative to the checkout', () => {
    assert.match(
      leakMessageOf('/repo/tools/scripts/a.spec.mjs', ['adr-1', 'adr-2'], '/repo'),
      /^tmp leak: tools\/scripts\/a\.spec\.mjs left 2 folders in \/tmp \(adr-1, adr-2\)/,
    );
  });
});

describe('the node --test hook', () => {
  it('fails a spec file that leaves a folder and names it', () => {
    const run = runSpec('leaky.spec.mjs', `mkdtempSync(join(tmpdir(), 'leaky-'));`);

    assert.notEqual(run.status, 0);
    assert.match(run.stderr + run.stdout, /tmp leak: leaky\.spec\.mjs left 1 folder in \/tmp \(leaky-\w{6}\)/);
  });

  it('passes a spec file that removes what it creates', () => {
    const run = runSpec(
      'clean.spec.mjs',
      `const dir = mkdtempSync(join(tmpdir(), 'clean-'));\nmkdirSync(join(dir, 'x'));\nrmSync(dir, { recursive: true });`,
    );

    assert.equal(run.status, 0, run.stdout + run.stderr);
  });
});

describe('the node --test hook, exit cleanup', () => {
  it('passes a spec file that removes its temp dir on exit', () => {
    const run = runSpec(
      'exit.spec.mjs',
      `const dir = mkdtempSync(join(tmpdir(), 'exit-'));\nprocess.once('exit', () => rmSync(dir, { recursive: true }));`,
    );

    assert.equal(run.status, 0, run.stdout + run.stderr);
  });
});

describe('withStepTmp', () => {
  it('warns on a push-suite step that leaves a folder, names the step, and keeps its status', async () => {
    const env = { TMPDIR: fixtures };
    const result = await withStepTmp(
      'tools',
      async () => {
        mkdirSync(join(env['TMPDIR'], 'wf-abc123'));
        return { status: 0, output: 'ok' };
      },
      env,
    );

    assert.equal(result.status, 0);
    assert.match(result.note, /tmp leak: push-suite step tools left 1 folder in \/tmp \(wf-abc123\)/);
    assert.equal(env['TMPDIR'], fixtures);
  });

  it('keeps a clean step as it is', async () => {
    const env = { TMPDIR: fixtures };
    const result = await withStepTmp('lint', async () => ({ status: 0, output: 'ok' }), env);

    assert.deepEqual(result, { status: 0, output: 'ok' });
  });
});
