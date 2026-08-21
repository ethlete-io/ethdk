import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PENDING_FILE, clearPendingUpdate, readPendingUpdate, writePendingUpdate } from './pending';
import { UPDATE_DIR } from './tasks';

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-pending-'));

describe('writePendingUpdate', () => {
  it('records what the update moves, and reads it back', () => {
    const root = makeRoot();
    const pending = {
      startedAt: '2026-08-21T00:00:00.000Z',
      packages: [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
    };

    writePendingUpdate({ root, pending });

    expect(readPendingUpdate(root)).toEqual(pending);
  });
});

describe('readPendingUpdate', () => {
  it('reads nothing when no update was left behind', () => {
    expect(readPendingUpdate(makeRoot())).toBeUndefined();
  });

  it('reads nothing from a file that is not valid json', () => {
    const root = makeRoot();

    mkdirSync(join(root, UPDATE_DIR), { recursive: true });
    writeFileSync(join(root, PENDING_FILE), '{ not json', 'utf8');

    expect(readPendingUpdate(root)).toBeUndefined();
  });

  it('drops an entry that names no version to move to', () => {
    const root = makeRoot();

    mkdirSync(join(root, UPDATE_DIR), { recursive: true });
    writeFileSync(
      join(root, PENDING_FILE),
      JSON.stringify({
        startedAt: 'then',
        packages: [{ name: '@ethlete/core' }, { name: '@ethlete/cli', to: '2.1.0' }],
      }),
      'utf8',
    );

    expect(readPendingUpdate(root)?.packages).toEqual([{ name: '@ethlete/cli', from: null, to: '2.1.0' }]);
  });
});

describe('clearPendingUpdate', () => {
  it('removes the file, and does not mind when it is already gone', () => {
    const root = makeRoot();

    writePendingUpdate({ root, pending: { startedAt: 'then', packages: [] } });
    clearPendingUpdate(root);

    expect(existsSync(join(root, PENDING_FILE))).toBe(false);
    expect(() => clearPendingUpdate(root)).not.toThrow();
  });
});
