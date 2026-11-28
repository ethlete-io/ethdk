import { cpSync, mkdtempSync, realpathSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { readConfig } from '../design-config';
import { ShotUnprocessableError } from '../thumb';
import { createAppStateShots } from './app-state-shot';
import { ShootStates } from './compare-command';

const acme = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-app-state-shot-')));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });
  onTestFinished(() => rmSync(target, { recursive: true, force: true }));

  return { target, config: readConfig(target) ?? {} };
};

const warm = { server: () => Promise.reject(new Error('no design server')), queue: () => ({}) as never };

describe('createAppStateShots', () => {
  it('shoots only the asked state in the harness app with its built root, as compare does, and hands back the app picture', async () => {
    const { target, config } = acme();
    const stop = vi.fn(async () => undefined);
    const shoot = vi.fn<ShootStates>(async () => ({
      states: { long: {} },
      shots: [{ state: 'long', design: Buffer.from('design'), app: Buffer.from('app') }],
    }));
    const shots = createAppStateShots({
      target,
      config,
      warm,
      shoot,
      start: async () => ({ url: 'http://localhost:9', root: '/built', stop }),
    });

    expect(await shots.shotOf({ product: 'acme', part: 'components/card', state: 'long', preset: 'phone' })).toEqual(
      Buffer.from('app'),
    );
    expect(shoot).toHaveBeenCalledWith(
      expect.objectContaining({
        part: 'components/card',
        url: 'http://localhost:9',
        only: ['long'],
        preset: 'phone',
        appOnly: true,
        appRoot: '/built',
      }),
    );
    expect(stop).toHaveBeenCalled();
  });

  it('fails as unprocessable with the reason compare could not shoot the state', async () => {
    const { target, config } = acme();
    const shots = createAppStateShots({
      target,
      config,
      warm,
      shoot: async () => ({ states: {}, shots: [{ state: 'long', problem: 'the harness page did not load' }] }),
      start: async () => ({ url: 'http://localhost:9', stop: async () => undefined }),
    });
    const shot = shots.shotOf({ product: 'acme', part: 'components/card', state: 'long', preset: null });

    await expect(shot).rejects.toThrow(ShotUnprocessableError);
    await expect(shot).rejects.toThrow('the harness page did not load');
  });

  it('fails as unprocessable when the product has no harness to start', async () => {
    const { target, config } = acme();
    const shoot = vi.fn<ShootStates>();
    const shots = createAppStateShots({
      target,
      config,
      warm,
      shoot,
      start: async ({ product }) => `product "${product.name}" has no harness in config.json`,
    });
    const shot = shots.shotOf({ product: 'acme', part: 'components/card', state: 'long', preset: null });

    await expect(shot).rejects.toThrow('product "acme" has no harness in config.json');
    expect(shoot).not.toHaveBeenCalled();
  });
});
