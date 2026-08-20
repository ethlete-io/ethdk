import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_LOCAL_CONFIG_FILE_NAME, LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { ApiDefinition } from './definition';
import { runApiCommand } from './run';

const HUB: ApiDefinition = {
  composeDir: 'development',
  services: ['app'],
  execService: 'app',
  port: 8040,
  envFile: '.env',
  setupCommand: 'make setup',
  examplePath: '../fut-hub-backend',
  exec: { install: ['composer', 'install'] },
};

const errors: string[] = [];
const warnings: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'warn').mockImplementation((message: unknown) => void warnings.push(String(message)));

afterEach(() => {
  errors.length = 0;
  warnings.length = 0;
});

const makeRoot = (files: Record<string, unknown> = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-run-'));

  for (const [fileName, contents] of Object.entries(files)) {
    writeFileSync(join(root, fileName), JSON.stringify(contents), 'utf8');
  }

  return root;
};

const run = (argv: string[], root: string) => runApiCommand({ apis: { hub: HUB }, argv, root });

describe('runApiCommand', () => {
  it('prints the help and the known APIs when the API is unknown', async () => {
    expect(await run(['up', 'nope'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('Usage: et api <command> <api>');
    expect(errors[0]).toContain('hub');
  });

  it('prints the help when no API is named', async () => {
    expect(await run(['up'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('Usage: et api <command> <api>');
  });

  it('answers --help on stdout and succeeds', async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

    expect(await run(['--help'], makeRoot())).toBe(0);
    expect(logs[0]).toContain('Usage: et api <command> <api>');
    expect(errors).toEqual([]);

    log.mockRestore();
  });

  it('lists the API’s own commands when the command is unknown', async () => {
    expect(await run(['bogus', 'hub'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('Unknown command "bogus" for the hub API.');
    expect(errors[0]).toContain('up, down, logs, shell, clone, checkout, pull, install');
  });

  it('names the config file when it does not exist', async () => {
    expect(await run(['up', 'hub'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('the API declares no repoUrl');
    expect(errors[0]).toContain('"hub": "../fut-hub-backend"');
  });

  it('names the missing entry when the config file has no path for this API', async () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { other: '../other' } } });

    expect(await run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain(`${LOCAL_CONFIG_FILE_NAME} has no apiRepoPaths entry for "hub"`);
  });

  it('reports a configured path that is not a directory', async () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './missing' } } });

    expect(await run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain('is not a directory that exists');
  });

  it('reports a checkout without the compose directory', async () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './api' } } });

    mkdirSync(join(root, 'api'));

    expect(await run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain('has no development directory');
  });

  it('names the setup command when the env file is missing', async () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './api' } } });

    mkdirSync(join(root, 'api/development'), { recursive: true });

    expect(await run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain('Missing .env in');
    expect(errors[0]).toContain('Run "make setup" there first.');
  });

  it('warns once when the paths still live in the legacy file', async () => {
    const root = makeRoot({ [LEGACY_LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './missing' } } });

    await run(['up', 'hub'], root);

    expect(warnings[0]).toContain(`${LEGACY_LOCAL_CONFIG_FILE_NAME} still holds "apiRepoPaths"`);
    expect(warnings[0]).toContain(`Move it to ${LOCAL_CONFIG_FILE_NAME}`);
  });
});

describe('runApiCommand with a repoUrl', () => {
  const withRepoUrl = { ...HUB, repoUrl: 'git@example.com:group/hub.git' };

  const runClonable = (argv: string[], root: string) => runApiCommand({ apis: { hub: withRepoUrl }, argv, root });

  it('offers the clone instead of asking for a path when nothing is configured', async () => {
    expect(await runClonable(['up', 'hub'], makeRoot())).toBe(1);
    expect(errors.join('\n')).toContain('hub has no checkout at');
    expect(errors.join('\n')).toContain('Re-run with --clone');
  });

  it('names the managed directory it would clone into', async () => {
    const root = makeRoot();

    await runClonable(['up', 'hub'], root);

    expect(errors.join('\n')).toContain(join(root, '.ethlete/hub'));
  });

  it('still asks for a path when the API declares no repoUrl', async () => {
    expect(await run(['up', 'hub'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('the API declares no repoUrl');
  });

  it('reports a configured path that is wrong rather than offering a clone', async () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './missing' } } });

    expect(await runClonable(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain('is not a directory that exists');
    expect(errors.join('\n')).not.toContain('Re-run with --clone');
  });
});
