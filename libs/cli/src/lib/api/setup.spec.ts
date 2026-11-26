import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runApiSetup } from './setup';

const logs: string[] = [];
const errors: string[] = [];

vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));
vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));

afterEach(() => {
  logs.length = 0;
  errors.length = 0;
});

const composePath = () => mkdtempSync(join(tmpdir(), 'cli-setup-'));

describe('runApiSetup', () => {
  it('creates the env file and reports it', () => {
    const dir = composePath();

    expect(runApiSetup({ setupCommand: 'echo x > .env', composePath: dir, envFile: '.env' })).toBe(0);
    expect(logs).toContain('Created .env.');
  });

  it('reports an env file that already existed', () => {
    const dir = composePath();

    writeFileSync(join(dir, '.env'), '', 'utf8');

    expect(runApiSetup({ setupCommand: 'true', composePath: dir, envFile: '.env' })).toBe(0);
    expect(logs).toContain('.env already existed.');
  });

  it('fails a command that exits 0 without creating the env file', () => {
    expect(runApiSetup({ setupCommand: 'true', composePath: composePath(), envFile: '.env' })).toBe(1);
    expect(errors.join('\n')).toContain('still does not exist');
  });

  it('prints the held-back output and keeps the exit code when the command fails', () => {
    expect(runApiSetup({ setupCommand: 'echo hint >&2; exit 3', composePath: composePath() })).toBe(3);
    expect(errors).toContain('hint');
    expect(errors.join('\n')).toContain('failed with exit code 3');
  });

  it('finishes without an env file to check', () => {
    expect(runApiSetup({ setupCommand: 'true', composePath: composePath() })).toBe(0);
    expect(logs).toContain('"true" finished.');
  });
});
