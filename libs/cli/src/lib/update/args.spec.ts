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

  it('reports a --from whose version is not a version, instead of migrating from 0.0.0', () => {
    const args = parseUpdateArgs(['--from', 'core@v5.0.0']);

    expect(args.problems).toEqual(['--from core@v5.0.0: "v5.0.0" is not a version.']);
    expect(args.from).toEqual({});
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

  it('reports an empty inline value instead of reading it as a tag or a version', () => {
    expect(parseUpdateArgs(['--tag=']).problems).toEqual(['--tag needs a value.']);
    expect(parseUpdateArgs(['core', '--to=']).problems).toEqual(['--to needs a value.']);
    expect(parseUpdateArgs(['--tag=']).tag).toBeUndefined();
  });

  it('reports a value written onto a boolean flag rather than ignoring it', () => {
    const args = parseUpdateArgs(['--dry-run=false', '--no-install=no']);

    expect(args.problems).toEqual(['--dry-run takes no value.', '--no-install takes no value.']);
    expect(args.dryRun).toBe(false);
    expect(args.install).toBe(true);
  });

  it('keeps reading after a value flag at the end of the line', () => {
    expect(parseUpdateArgs(['core', '--tag']).problems).toEqual(['--tag needs a value.']);
    expect(parseUpdateArgs(['core', '--tag']).packages).toEqual(['@ethlete/core']);
  });

  it('splits --from at the last @ of a scoped prerelease', () => {
    expect(parseUpdateArgs(['--from', '@ethlete/core@5.0.0-next.1']).from).toEqual({
      '@ethlete/core': '5.0.0-next.1',
    });
    expect(parseUpdateArgs(['--from', '@ethlete/core']).problems).toEqual([
      '--from needs <package>@<version>, not "@ethlete/core".',
    ]);
  });
});
