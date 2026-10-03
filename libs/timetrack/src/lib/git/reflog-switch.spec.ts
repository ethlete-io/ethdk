import { describe, expect, it } from 'vitest';
import { GIT_FIELD_SEPARATOR } from './format';
import { branchOrNothing, gitBranchSwitchesIn } from './reflog-switch';

const line = (stamp: string, subject: string) => `HEAD@{${stamp}}${GIT_FIELD_SEPARATOR}${subject}`;

describe('gitBranchSwitchesIn', () => {
  it('reads nothing from empty output', () => {
    expect(gitBranchSwitchesIn('')).toEqual([]);
    expect(gitBranchSwitchesIn('\n\n')).toEqual([]);
  });

  it('returns the switches oldest first, whatever order the reflog printed them in', () => {
    const output = [
      line('2026-08-11T10:00:00+02:00', 'checkout: moving from main to feat/a'),
      line('2026-08-11T09:00:00+02:00', 'checkout: moving from feat/a to main'),
    ].join('\n');

    expect(gitBranchSwitchesIn(output).map((entry) => entry.to)).toEqual(['main', 'feat/a']);
  });

  it('orders two switches across the night the clocks go forward by their instant, not their wall time', () => {
    const output = [
      line('2026-03-29T03:10:00+02:00', 'checkout: moving from b to c'),
      line('2026-03-29T01:50:00+01:00', 'checkout: moving from a to b'),
    ].join('\n');

    const switches = gitBranchSwitchesIn(output);

    expect(switches.map((entry) => entry.to)).toEqual(['b', 'c']);
    expect(switches[1]!.at.getTime() - switches[0]!.at.getTime()).toBe(20 * 60_000);
  });

  it('skips entries that are not a checkout, such as a commit, a reset or a rebase', () => {
    const output = [
      line('2026-08-11T09:00:00+02:00', 'commit: Add the invite flow'),
      line('2026-08-11T09:01:00+02:00', 'reset: moving to HEAD~1'),
      line('2026-08-11T09:02:00+02:00', 'rebase (start): checkout main'),
    ].join('\n');

    expect(gitBranchSwitchesIn(output)).toEqual([]);
  });

  it('skips a malformed line rather than failing the whole read', () => {
    const output = [
      'garbage',
      `${GIT_FIELD_SEPARATOR}checkout: moving from a to b`,
      line('not a date', 'checkout: moving from a to b'),
      'HEAD@{2026-08-11T09:00:00+02:00}',
      line('2026-08-11T10:00:00+02:00', 'checkout: moving from a to b'),
    ].join('\n');

    expect(gitBranchSwitchesIn(output)).toEqual([{ at: new Date('2026-08-11T10:00:00+02:00'), from: 'a', to: 'b' }]);
  });

  it('reads output with Windows line endings', () => {
    const output = `${line('2026-08-11T10:00:00+02:00', 'checkout: moving from a to b')}\r\n`;

    expect(gitBranchSwitchesIn(output)).toEqual([{ at: new Date('2026-08-11T10:00:00+02:00'), from: 'a', to: 'b' }]);
  });
});

describe('branchOrNothing', () => {
  it('reads a detached object name as no branch', () => {
    expect(branchOrNothing('abc1234')).toBeUndefined();
    expect(branchOrNothing('0123456789abcdef0123456789abcdef01234567')).toBeUndefined();
  });

  it('keeps a branch name, including one shorter than an abbreviated object name', () => {
    expect(branchOrNothing('feat/FIP-1')).toBe('feat/FIP-1');
    expect(branchOrNothing('abc')).toBe('abc');
    expect(branchOrNothing('ABC1234')).toBe('ABC1234');
  });
});
