import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { initGitRepo } from '../git-repo.fixtures';
import { REBASE_UNCOMMITTED_FILE, rebaseUncommittedOf } from './rebase-uncommitted';

describe('rebaseUncommittedOf', () => {
  let target = '';

  afterEach(() => rmSync(target, { recursive: true, force: true }));

  it('answers a recorded sketch while its files are dirty, and drops one that is clean or not recorded', () => {
    target = realpathSync(mkdtempSync(join(tmpdir(), 'rebase-uncommitted-')));

    const dirOf = (name: string) => join(target, 'sketches', name);

    for (const name of ['dirty', 'clean', 'unrecorded']) {
      mkdirSync(dirOf(name), { recursive: true });
      writeFileSync(join(dirOf(name), 'sketch.json'), '{}\n');
    }

    initGitRepo(target, 'init');
    writeFileSync(join(dirOf('dirty'), 'sketch.json'), '{"rebased":true}\n');
    writeFileSync(join(dirOf('unrecorded'), 'sketch.json'), '{"rebased":true}\n');
    writeFileSync(
      join(target, REBASE_UNCOMMITTED_FILE),
      JSON.stringify({ dirty: { commit: 'abc1234' }, clean: { commit: 'abc1234' } }),
    );

    const found = rebaseUncommittedOf({
      productDir: target,
      dirs: ['dirty', 'clean', 'unrecorded'].map(dirOf),
    });

    expect([...found]).toEqual([[dirOf('dirty'), { commit: 'abc1234' }]]);
  });
});
