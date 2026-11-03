import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLI_REBUILD_COMMAND, staleCliDistWarning } from './stale-cli-dist';

describe('staleCliDistWarning', () => {
  let root: string;
  const distDir = () => join(root, 'dist/libs/cli');
  const source = () => join(root, 'libs/cli/src/index.ts');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'b191-'));
    mkdirSync(distDir(), { recursive: true });
    mkdirSync(join(root, 'libs/cli/src'), { recursive: true });
    writeFileSync(source(), '');
    writeFileSync(join(distDir(), 'build-info.json'), JSON.stringify({ builtAt: '2026-01-02T00:00:00.000Z' }));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('warns with both times and the rebuild command when a source file is newer than the build', () => {
    utimesSync(source(), new Date('2026-01-03T00:00:00Z'), new Date('2026-01-03T00:00:00Z'));

    const warning = staleCliDistWarning({ distDir: distDir(), repoRoot: root });

    expect(warning).toContain('WARN');
    expect(warning).toContain('2026-01-02T00:00:00.000Z');
    expect(warning).toContain('2026-01-03T00:00:00.000Z');
    expect(warning).toContain(CLI_REBUILD_COMMAND);
  });

  it('stays silent when the build is newer than every source file', () => {
    utimesSync(source(), new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));

    expect(staleCliDistWarning({ distDir: distDir(), repoRoot: root })).toBeNull();
  });

  it('stays silent outside a repo checkout', () => {
    rmSync(join(root, 'libs'), { recursive: true });

    expect(staleCliDistWarning({ distDir: distDir(), repoRoot: root })).toBeNull();
  });
});
