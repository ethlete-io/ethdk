import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { sketchedPartsOf } from './visible-change';
import { baseCommitOf, mergedInRangeOf, sketchEvidenceOf } from './visible-change-command';

const repoOf = () => {
  const root = mkdtempSync(join(tmpdir(), 'et-visible-change-spec-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  const write = (file: string, value: unknown) => {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), JSON.stringify(value));
  };

  git('init', '--quiet');

  return { root, git, write };
};

describe('sketchEvidenceOf', () => {
  it('finds picked sketches and sketches a merge deleted in base..HEAD, not a discarded deletion or older ones', () => {
    const { root, git, write } = repoOf();
    const dir = '.ethlete/design/app';

    try {
      write(`${dir}/sketches/components-old/sketch.json`, { target: 'components/old', decision: { kind: 'pick' } });
      write(`${dir}/sketches/components-chip/sketch.json`, { target: 'components/chip', status: 'ready' });
      write(`${dir}/sketches/components-card/sketch.json`, { target: 'components/card', status: 'ready' });
      git('add', '.');
      git('commit', '--quiet', '-m', 'base');

      const base = git('rev-parse', 'HEAD');

      write(`${dir}/sketches/components-badge/sketch.json`, {
        target: 'components/badge',
        targets: ['components/badge', 'pages/home'],
        decision: { kind: 'pick' },
      });
      git('add', '.');
      git('commit', '--quiet', '-m', 'pick');
      git('rm', '--quiet', '-r', `${dir}/sketches/components-chip`);
      write(`${dir}/merged.json`, { 'components/chip': 'abc' });
      git('add', '.');
      git('commit', '--quiet', '-m', 'merge');
      git('rm', '--quiet', '-r', `${dir}/sketches/components-card`);
      git('commit', '--quiet', '-m', 'discard');

      const evidence = sketchEvidenceOf({ root, base, productDir: join(root, dir) });

      expect(sketchedPartsOf(evidence)).toEqual(new Set(['components/badge', 'pages/home', 'components/chip']));
      expect(baseCommitOf({ root, base })).toBe(base);
      expect(baseCommitOf({ root, base: 'nope' })).toBe('no commit "nope"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('mergedInRangeOf', () => {
  it('finds a part a merge recorded in merged.json in base..HEAD with no sketch.json ever committed', () => {
    const { root, git, write } = repoOf();
    const dir = '.ethlete/design/app';

    try {
      write(`${dir}/merged.json`, { 'components/chip': 'abc' });
      git('add', '.');
      git('commit', '--quiet', '-m', 'base');

      const base = git('rev-parse', 'HEAD');

      write(`${dir}/merged.json`, { 'components/chip': 'abd', 'components/update-dialog': 'def' });
      git('add', '.');
      git('commit', '--quiet', '-m', 'merge');

      expect(mergedInRangeOf({ root, base, productDir: join(root, dir) })).toEqual(
        new Set(['components/update-dialog']),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
