import { describe, expect, it } from 'vitest';
import { fullPackageName, parseUpdateArgs } from './args';

describe('fullPackageName', () => {
  it('adds the scope to a short name', () => {
    expect(fullPackageName('core')).toBe('@ethlete/core');
  });

  it('keeps a full name', () => {
    expect(fullPackageName('@ethlete/core')).toBe('@ethlete/core');
  });
});

describe('parseUpdateArgs', () => {
  it('defaults to every package, with an install', () => {
    const args = parseUpdateArgs([]);

    expect(args.packages).toEqual([]);
    expect(args.install).toBe(true);
    expect(args.problems).toEqual([]);
  });

  it('reads package names', () => {
    expect(parseUpdateArgs(['core', '@ethlete/query']).packages).toEqual(['@ethlete/core', '@ethlete/query']);
  });

  it('reads a flag value written either way', () => {
    expect(parseUpdateArgs(['--tag', 'next']).tag).toBe('next');
    expect(parseUpdateArgs(['--tag=next']).tag).toBe('next');
  });

  it('reads --from as a package and a version', () => {
    expect(parseUpdateArgs(['--from', 'core@5.0.0-next.1']).from).toEqual({ '@ethlete/core': '5.0.0-next.1' });
  });

  it('reads --from for a scoped name', () => {
    expect(parseUpdateArgs(['--from', '@ethlete/core@5.0.0']).from).toEqual({ '@ethlete/core': '5.0.0' });
  });

  it('reports a --from without a version', () => {
    expect(parseUpdateArgs(['--from', 'core']).problems).toEqual(['--from needs <package>@<version>, not "core".']);
  });

  it('reads the boolean flags', () => {
    const args = parseUpdateArgs(['--check', '--dry-run', '--no-install', '--continue', '--ai', '--force']);

    expect(args).toMatchObject({
      check: true,
      dryRun: true,
      install: false,
      resume: true,
      ai: true,
      force: true,
    });
  });

  it('reports an unknown flag', () => {
    expect(parseUpdateArgs(['--nope']).problems).toEqual(['Unknown flag "--nope".']);
  });

  it('reports a flag with no value', () => {
    expect(parseUpdateArgs(['--tag']).problems).toEqual(['--tag needs a value.']);
    expect(parseUpdateArgs(['--tag', '--check']).problems).toEqual(['--tag needs a value.']);
  });

  it('refuses --to together with --tag', () => {
    expect(parseUpdateArgs(['core', '--to', '5.0.0', '--tag', 'next']).problems).toContain(
      '--to and --tag ask for different targets. Pass one of them.',
    );
  });

  it('refuses --to without exactly one package', () => {
    expect(parseUpdateArgs(['--to', '5.0.0']).problems).toContain(
      '--to sets the version of one package, so name that package.',
    );
  });
});
