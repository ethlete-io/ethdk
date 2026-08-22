import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposeTool } from '../api/compose';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { doctorCommand } from './doctor-command';

const PRESENT_COMPOSE_TOOLS: ComposeTool[] = [{ engine: 'test', compose: ['echo'] }];
const ABSENT_COMPOSE_TOOLS: ComposeTool[] = [{ engine: 'test', compose: ['definitely-not-a-real-binary'] }];

const logs: string[] = [];
const errors: string[] = [];

vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));
vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));

afterEach(() => {
  logs.length = 0;
  errors.length = 0;
});

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-doctor-'));

const write = (root: string, fileName: string, contents: string) =>
  writeFileSync(join(root, fileName), contents, 'utf8');

describe('doctorCommand', () => {
  it('reports a broken config file and fails', () => {
    const root = makeRoot();

    write(root, LOCAL_CONFIG_FILE_NAME, '{ not json');

    expect(doctorCommand({ root, composeTools: PRESENT_COMPOSE_TOOLS })).toBe(1);
    expect(errors.join('\n')).toContain('is not valid JSON');
  });

  it('reports an API whose checkout is not there', () => {
    const root = makeRoot();

    write(root, LOCAL_CONFIG_FILE_NAME, JSON.stringify({ apiRepoPaths: { hub: './missing' } }));
    write(root, 'package.json', JSON.stringify({ name: 'host' }));
    write(root, 'ethlete.apis.js', "module.exports = { hub: { composeDir: 'development' } };");

    expect(doctorCommand({ root, composeTools: PRESENT_COMPOSE_TOOLS })).toBe(1);
    expect(errors.join('\n')).toContain('apiRepoPaths.hub');
  });

  it('names the fix with the invocation it was given', () => {
    const root = makeRoot();

    mkdirSync(join(root, 'api/development'), { recursive: true });
    write(root, LOCAL_CONFIG_FILE_NAME, JSON.stringify({ apiRepoPaths: { hub: './api' } }));
    write(root, 'package.json', JSON.stringify({ name: 'host' }));
    write(
      root,
      'ethlete.apis.js',
      "module.exports = { hub: { composeDir: 'development', envFile: '.env', setupCommand: 'make setup' } };",
    );

    expect(doctorCommand({ root, apiInvocation: 'yarn api', composeTools: PRESENT_COMPOSE_TOOLS })).toBe(1);
    expect(errors.join('\n')).toContain('Run "yarn api setup hub".');
  });

  it('lists a resolved API and succeeds', () => {
    const root = makeRoot();

    mkdirSync(join(root, 'api/development'), { recursive: true });
    write(root, LOCAL_CONFIG_FILE_NAME, JSON.stringify({ apiRepoPaths: { hub: './api' } }));
    write(root, 'package.json', JSON.stringify({ name: 'host' }));
    write(root, 'ethlete.apis.js', "module.exports = { hub: { composeDir: 'development' } };");

    expect(doctorCommand({ root, composeTools: PRESENT_COMPOSE_TOOLS })).toBe(0);
    expect(logs.join('\n')).toContain('ethlete.apis.js: hub →');
    expect(logs.join('\n')).toContain('No problems found.');
  });

  it('reports no compose tool found and fails', () => {
    const root = makeRoot();

    mkdirSync(join(root, 'api/development'), { recursive: true });
    write(root, LOCAL_CONFIG_FILE_NAME, JSON.stringify({ apiRepoPaths: { hub: './api' } }));
    write(root, 'package.json', JSON.stringify({ name: 'host' }));
    write(root, 'ethlete.apis.js', "module.exports = { hub: { composeDir: 'development' } };");

    expect(doctorCommand({ root, composeTools: ABSENT_COMPOSE_TOOLS })).toBe(1);
    expect(errors.join('\n')).toContain('No compose tool found. Tried: definitely-not-a-real-binary.');
  });

  it('says there is nothing to check when the repo has neither file', () => {
    expect(doctorCommand({ root: makeRoot(), composeTools: PRESENT_COMPOSE_TOOLS })).toBe(0);
    expect(logs.join('\n')).toContain('Nothing to check');
    expect(logs.join('\n')).not.toContain('No problems found');
  });

  it('still checks the config when the repo declares no APIs', () => {
    const root = makeRoot();

    write(root, LOCAL_CONFIG_FILE_NAME, JSON.stringify({ sdkSourcePath: './nope' }));

    expect(doctorCommand({ root, composeTools: PRESENT_COMPOSE_TOOLS })).toBe(1);
    expect(errors.join('\n')).toContain('does not exist');
  });
});
