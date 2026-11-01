import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { judgeServerIdentity, ServerIdentity, serverIdentityOf, STUDIO_API_LEVEL } from './server-identity';

const roots: string[] = [];

const projectWithCli = (options: { code: string; builtAt: number; version?: string; infoBuiltAt?: string }) => {
  const project = mkdtempSync(join(tmpdir(), 'identity-'));
  roots.push(project);
  const cli = join(project, 'node_modules/@ethlete/cli');
  mkdirSync(join(cli, 'src/lib/design'), { recursive: true });
  mkdirSync(join(cli, 'design'), { recursive: true });
  writeFileSync(join(project, 'package.json'), '{}');
  writeFileSync(
    join(cli, 'package.json'),
    JSON.stringify({ name: '@ethlete/cli', version: options.version ?? '1.0.0' }),
  );
  const file = join(cli, 'src/lib/design/serve.js');
  writeFileSync(file, options.code);
  utimesSync(file, options.builtAt / 1000, options.builtAt / 1000);
  if (options.infoBuiltAt)
    writeFileSync(join(cli, 'build-info.json'), JSON.stringify({ builtAt: options.infoBuiltAt }));

  return project;
};

afterEach(() => {
  while (roots.length) rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe('serverIdentityOf', () => {
  it('reports the running build, the api level, the project and the installed cli', () => {
    const project = projectWithCli({ code: 'a', builtAt: 1_000_000 });
    const identity = serverIdentityOf(project)();

    expect(identity.apiLevel).toBe(STUDIO_API_LEVEL);
    expect(identity.projectRoot).toBe(project);
    expect(identity.stamp.build).toMatch(/^[0-9a-f]{12}$/);
    expect(identity.builtAt).toBeGreaterThan(0);
    expect(identity.installed).toMatchObject({ builtAt: 1_000_000, stamp: { version: '1.0.0' } });
  });

  it('reads the build time from build-info.json when every file time is 1985', () => {
    const year1985 = Date.UTC(1985, 9, 26);
    const project = projectWithCli({ code: 'a', builtAt: year1985, infoBuiltAt: '2026-05-01T00:00:00.000Z' });

    expect(serverIdentityOf(project)().installed?.builtAt).toBe(Date.UTC(2026, 4, 1));
  });

  it('judges a 1985 install with a newer build-info.json as a restart', () => {
    const year1985 = Date.UTC(1985, 9, 26);
    const project = projectWithCli({ code: 'b', builtAt: year1985, infoBuiltAt: '2026-05-01T00:00:00.000Z' });
    const installed = serverIdentityOf(project)().installed;

    expect(
      judgeServerIdentity({
        expectedApiLevel: STUDIO_API_LEVEL,
        identity: {
          stamp: { version: '1.0.0', build: 'aaa' },
          apiLevel: STUDIO_API_LEVEL,
          builtAt: Date.UTC(2026, 0, 1),
          projectRoot: project,
          installed,
        },
      }).verdict,
    ).toBe('restart');
  });

  it('keeps the stamp when only build-info.json changes', () => {
    const a = projectWithCli({ code: 'a', builtAt: 1_000_000, infoBuiltAt: '2026-01-01T00:00:00.000Z' });
    const b = projectWithCli({ code: 'a', builtAt: 1_000_000, infoBuiltAt: '2026-06-01T00:00:00.000Z' });

    expect(serverIdentityOf(a)().installed?.stamp).toEqual(serverIdentityOf(b)().installed?.stamp);
  });

  it('reads the installed cli at request time', () => {
    const project = projectWithCli({ code: 'a', builtAt: 1_000_000 });
    const identityOf = serverIdentityOf(project);
    const before = identityOf().installed;

    writeFileSync(join(project, 'node_modules/@ethlete/cli/src/lib/design/serve.js'), 'b');

    expect(identityOf().installed?.stamp.build).not.toBe(before?.stamp.build);
  });

  it('reports no installed cli when the project has none', () => {
    const project = mkdtempSync(join(tmpdir(), 'identity-'));
    roots.push(project);
    writeFileSync(join(project, 'package.json'), '{}');

    expect(serverIdentityOf(project)().installed).toBeNull();
  });
});

describe('judgeServerIdentity', () => {
  const stamp = (build: string, version = '3.0.0-next.26') => ({ version, build });
  const identity = (patch: Partial<ServerIdentity> = {}): ServerIdentity => ({
    stamp: stamp('aaa'),
    apiLevel: 2,
    builtAt: 2000,
    projectRoot: '/work/app',
    installed: { stamp: stamp('aaa'), builtAt: 2000 },
    ...patch,
  });

  it('is ok when the server runs what is installed and meets Studio', () => {
    expect(judgeServerIdentity({ expectedApiLevel: 2, identity: identity() })).toEqual({
      verdict: 'ok',
      message: null,
    });
  });

  it('is ok when no cli is installed in the project', () => {
    expect(judgeServerIdentity({ expectedApiLevel: 2, identity: identity({ installed: null }) }).verdict).toBe('ok');
  });

  it('asks for an update when the api level is below expected, even with equal build times', () => {
    const result = judgeServerIdentity({
      expectedApiLevel: 2,
      expectedBuiltAt: 2000,
      identity: identity({ apiLevel: 1 }),
    });

    expect(result.verdict).toBe('update');
  });

  it('asks for a restart when the installed cli is newer than the running one', () => {
    const result = judgeServerIdentity({
      expectedApiLevel: 2,
      identity: identity({ installed: { stamp: stamp('bbb'), builtAt: 3000 } }),
    });

    expect(result.verdict).toBe('restart');
    expect(result.message).toMatch(/Restart the server/);
  });

  it('asks for a restart for a newer build even with the same version string', () => {
    const result = judgeServerIdentity({
      expectedApiLevel: 2,
      identity: identity({ installed: { stamp: stamp('bbb'), builtAt: 3000 } }),
    });

    expect(result.verdict).toBe('restart');
  });

  it('does not ask for a restart when the installed cli is older than the running one', () => {
    const result = judgeServerIdentity({
      expectedApiLevel: 2,
      identity: identity({ installed: { stamp: stamp('bbb'), builtAt: 1000 } }),
    });

    expect(result.verdict).toBe('ok');
  });

  it('asks for an update when the api level is below Studio', () => {
    const result = judgeServerIdentity({ expectedApiLevel: 3, identity: identity() });

    expect(result.verdict).toBe('update');
    expect(result.message).toContain('Update @ethlete/cli in /work/app');
  });

  it('asks for an update when the build is older than Studio expects (tomflix: same version, older build)', () => {
    const result = judgeServerIdentity({ expectedApiLevel: 2, expectedBuiltAt: 5000, identity: identity() });

    expect(result.verdict).toBe('update');
  });

  it('does not ask for an update while the installed cli differs, since a restart comes first', () => {
    const result = judgeServerIdentity({
      expectedApiLevel: 3,
      identity: identity({ installed: { stamp: stamp('bbb'), builtAt: 3000 } }),
    });

    expect(result.verdict).toBe('restart');
  });

  it('asks for an update when the server reports no identity', () => {
    expect(judgeServerIdentity({ expectedApiLevel: 2, identity: null }).verdict).toBe('update');
    expect(judgeServerIdentity({ expectedApiLevel: 2, identity: { stamp: stamp('aaa') } }).verdict).toBe('update');
  });
});
