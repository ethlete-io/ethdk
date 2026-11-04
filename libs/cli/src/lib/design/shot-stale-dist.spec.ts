import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, statSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designCommand } from './design-command';
import { designShot } from './shot-command';

vi.mock('child_process', async (importOriginal) => ({ ...(await importOriginal<object>()), spawnSync: vi.fn() }));
vi.mock('./shot-command', async (importOriginal) => ({ ...(await importOriginal<object>()), designShot: vi.fn() }));

const OLD = 1_000;
const NEW = 2_000;

const file = (path: string, content: string, at: number) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  utimesSync(path, at, at);
};

const checkoutWithStaleDist = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-shot-stale-dist-'));

  file(
    join(target, '.ethlete/design/config.json'),
    JSON.stringify({ render: { packages: { '@ethlete/*': 'dist/libs/*' }, modules: ['@ethlete/core'] } }),
    OLD,
  );
  file(join(target, 'libs/core/src/index.ts'), 'export {};', NEW);
  file(join(target, 'dist/libs/core/package.json'), JSON.stringify({ name: '@ethlete/core' }), OLD);

  return target;
};

describe('et design shot on a stale SDK dist', () => {
  afterEach(() => vi.clearAllMocks());

  it('rebuilds the stale lib, then draws', async () => {
    const target = checkoutWithStaleDist();

    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
    vi.mocked(designShot).mockResolvedValue(0);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(designCommand({ root: target, argv: ['shot', 'x/y'], invocation: 'et design' })).resolves.toBe(0);

    expect(vi.mocked(spawnSync).mock.calls[0]?.slice(0, 2)).toEqual([
      'npx',
      ['nx', 'build', 'core', '--skip-nx-cache'],
    ]);
    expect(statSync(join(target, 'dist/libs/core/package.json')).mtimeMs).toBeGreaterThan(NEW * 1000);
    expect(designShot).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('refuses with the build command, and does not draw, when the rebuild fails', async () => {
    const target = checkoutWithStaleDist();

    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(designCommand({ root: target, argv: ['shot', 'x/y'], invocation: 'et design' })).resolves.toBe(1);

    expect(error.mock.calls.flat().join('\n')).toContain(
      'REFUSED STALE BUILD @ethlete/core - the build failed; fix it and run NX_NO_CLOUD=true npx nx build core --skip-nx-cache',
    );
    expect(designShot).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
