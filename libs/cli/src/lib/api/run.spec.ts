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
  it('prints the help and the known APIs when the API is unknown', () => {
    expect(run(['up', 'nope'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('Usage: et api <command> <api>');
    expect(errors[0]).toContain('hub');
  });

  it('prints the help when no API is named', () => {
    expect(run(['up'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('Usage: et api <command> <api>');
  });

  it('answers --help on stdout and succeeds', () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

    expect(run(['--help'], makeRoot())).toBe(0);
    expect(logs[0]).toContain('Usage: et api <command> <api>');
    expect(errors).toEqual([]);

    log.mockRestore();
  });

  it('lists the API’s own commands when the command is unknown', () => {
    expect(run(['bogus', 'hub'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('Unknown command "bogus" for the hub API.');
    expect(errors[0]).toContain('up, down, logs, shell, checkout, pull, install');
  });

  it('names the config file when it does not exist', () => {
    expect(run(['up', 'hub'], makeRoot())).toBe(1);
    expect(errors[0]).toContain(`${LOCAL_CONFIG_FILE_NAME} does not exist.`);
    expect(errors[0]).toContain('"hub": "../fut-hub-backend"');
  });

  it('names the missing entry when the config file has no path for this API', () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { other: '../other' } } });

    expect(run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain(`${LOCAL_CONFIG_FILE_NAME} has no apiRepoPaths entry for "hub"`);
  });

  it('reports a configured path that is not a directory', () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './missing' } } });

    expect(run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain('is not a directory that exists');
  });

  it('reports a checkout without the compose directory', () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './api' } } });

    mkdirSync(join(root, 'api'));

    expect(run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain('has no development directory');
  });

  it('names the setup command when the env file is missing', () => {
    const root = makeRoot({ [LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './api' } } });

    mkdirSync(join(root, 'api/development'), { recursive: true });

    expect(run(['up', 'hub'], root)).toBe(1);
    expect(errors[0]).toContain('Missing .env in');
    expect(errors[0]).toContain('Run "make setup" there first.');
  });

  it('warns once when the paths still live in the legacy file', () => {
    const root = makeRoot({ [LEGACY_LOCAL_CONFIG_FILE_NAME]: { apiRepoPaths: { hub: './missing' } } });

    run(['up', 'hub'], root);

    expect(warnings[0]).toContain(`${LEGACY_LOCAL_CONFIG_FILE_NAME} still holds "apiRepoPaths"`);
    expect(warnings[0]).toContain(`Move it to ${LOCAL_CONFIG_FILE_NAME}`);
  });
});
