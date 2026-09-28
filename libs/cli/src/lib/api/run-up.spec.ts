import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { runApiCommand } from './run';

const LOUD_COMPOSE = `process.stdout.write('x'.repeat(2 * 1024 * 1024))`;

vi.mock('./compose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./compose')>()),
  resolveComposeTool: () => ({ engine: 'fake-engine', compose: [process.execPath, '-e', LOUD_COMPOSE] }),
  composeContainerIds: () => [],
  composeOutput: () => undefined,
  containerStates: () => [],
}));

const errors: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'log').mockImplementation(() => undefined);

describe('runApiCommand up', () => {
  it('survives a compose run that writes more than a megabyte', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-api-up-'));

    writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
    mkdirSync(join(root, 'api/development'), { recursive: true });
    writeFileSync(join(root, 'api/development/.env'), '', 'utf8');

    await runApiCommand({
      apis: { hub: { composeDir: 'development', services: ['app'], execService: 'app', port: 8040, envFile: '.env' } },
      argv: ['up', 'hub', '--force'],
      root,
    });

    expect(errors.join('\n')).not.toContain('ENOBUFS');
    expect(errors.join('\n')).toContain('app is not running.');
  });
});
