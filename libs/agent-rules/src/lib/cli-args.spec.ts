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

  it('reads --help and -h for every command', () => {
    expect(parseCommandArgs('init', ['--help'])).toMatchObject({ help: true, problems: [] });
    expect(parseCommandArgs('migrate', ['-h'])).toMatchObject({ help: true, problems: [] });
  });

  it('rejects --targets for init', () => {
    expect(parseCommandArgs('init', ['--targets', 'claude']).problems).toEqual([
      'Unknown flag "--targets" for init.',
      'Unexpected argument "claude".',
    ]);
  });

  it('reports a value written onto a boolean flag rather than ignoring it', () => {
    expect(parseCommandArgs('sync', ['--dry-run=false'])).toMatchObject({
      dryRun: false,
      problems: ['--dry-run takes no value.'],
    });
    expect(parseCommandArgs('sync', ['--help=yes']).problems).toEqual(['--help takes no value.']);
  });

  it('drops empty entries from --targets, and reports a list with nothing in it', () => {
    expect(parseCommandArgs('sync', ['--targets', ' claude, ,codex,']).targets).toEqual(['claude', 'codex']);
    expect(parseCommandArgs('sync', ['--targets=,']).problems).toEqual(['--targets needs a value.']);
    expect(parseCommandArgs('sync', ['--targets=,']).targets).toBeUndefined();
  });

  it('reports an empty inline value', () => {
    expect(parseCommandArgs('sync', ['--root=']).problems).toEqual(['--root needs a value.']);
  });

  it('does not take the next flag as a value', () => {
    expect(parseCommandArgs('sync', ['--root', '--dry-run'])).toMatchObject({
      dryRun: false,
      problems: ['--root needs a value.'],
    });
  });

  it('reports a command it does not know a flag for', () => {
    expect(parseCommandArgs('nope', ['--root', '/repo']).problems).toEqual([
      'Unknown flag "--root" for nope.',
      'Unexpected argument "/repo".',
    ]);
  });
});
