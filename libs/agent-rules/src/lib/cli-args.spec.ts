import { describe, expect, it } from 'vitest';
import { parseCommandArgs } from './cli-args';

describe('parseCommandArgs', () => {
  it('reads the flags a command takes', () => {
    expect(parseCommandArgs('sync', ['--targets', 'claude,codex', '--root=/repo', '--dry-run'])).toEqual({
      targets: ['claude', 'codex'],
      root: '/repo',
      dryRun: true,
      help: false,
      problems: [],
    });
  });

  it('reports a misspelled flag instead of dropping it', () => {
    expect(parseCommandArgs('sync', ['--dryrun', '--target', 'claude']).problems).toEqual([
      'Unknown flag "--dryrun" for sync.',
      'Unknown flag "--target" for sync.',
      'Unexpected argument "claude".',
    ]);
  });

  it('reports a flag the command does not take', () => {
    expect(parseCommandArgs('check', ['--dry-run']).problems).toEqual(['Unknown flag "--dry-run" for check.']);
  });

  it('reports a value flag without a value', () => {
    expect(parseCommandArgs('sync', ['--root']).problems).toEqual(['--root needs a value.']);
  });
});
