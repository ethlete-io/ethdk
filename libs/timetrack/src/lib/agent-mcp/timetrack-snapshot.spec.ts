import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askTimetrack } from './client.mts';
import dayRowsHidden from './fixtures/day-rows-hidden.json';
import dayRows from './fixtures/day-rows.json';
import legacySnapshot from './fixtures/legacy-snapshot.json';
import { runSnapshot } from './timetrack-snapshot.mts';

vi.mock(import('./client.mts'), async (original) => ({ ...(await original()), askTimetrack: vi.fn() }));

const legacyPath = fileURLToPath(new URL('./fixtures/legacy-snapshot.json', import.meta.url));
const day = dayRows.value.day;
const now = new Date(2026, 7, 12, 18);
const asked = vi.mocked(askTimetrack);
const print = vi.spyOn(console, 'log');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'timetrack-snapshot-'));
  vi.stubEnv('TIMETRACK_AGENT_DISCOVERY', join(root, 'agent.json'));
  vi.stubEnv('TIMETRACK_SNAPSHOT_DIR', '');
  asked.mockReset().mockResolvedValue(dayRows.value);
  print.mockReset().mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe('Timetrack snapshot script', () => {
  it('writes the same row fields and day totals as the old command', async () => {
    const path = join(root, 'snapshot.json');

    expect(await runSnapshot([day, day, '--root', root, '--out', 'snapshot.json', '--json'], now)).toBe(0);
    expect(asked.mock.calls).toEqual([[{ op: 'day.rows', day }]]);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ ...legacySnapshot, takenAt: now.toISOString() });
    expect(print.mock.calls).toEqual([[JSON.stringify({ path, days: 1 })]]);
  });

  it('compares an existing snapshot against its original day', async () => {
    expect(await runSnapshot(['--compare', legacyPath, '--root', root])).toBe(0);
    expect(asked.mock.calls).toEqual([[{ op: 'day.rows', day }]]);
    expect(print.mock.calls).toEqual([['0 day(s), 0 row(s) changed']]);
  });

  it('reports a hidden row in the same format and exits 1', async () => {
    asked.mockResolvedValue(dayRowsHidden.value);

    expect(await runSnapshot(['--compare', legacyPath, '--root', root])).toBe(1);
    expect(print.mock.calls).toEqual([
      ['1 day(s), 1 row(s) changed'],
      [day],
      [`  changed  ${dayRowsHidden.value.hidden[0]?.id}`],
      ['    hidden: false → true'],
    ]);
  });

  it('records seven days ending today in the discovery file’s snapshots directory', async () => {
    expect(await runSnapshot(['--root', root], now)).toBe(0);
    expect(asked.mock.calls).toEqual(
      ['06', '07', '08', '09', '10', '11', '12'].map((date) => [{ op: 'day.rows', day: `2026-08-${date}` }]),
    );
    const path = join(root, 'snapshots', `${now.toISOString().replace(/[:.]/g, '-')}.json`);

    expect(JSON.parse(await readFile(path, 'utf8')).days).toHaveLength(7);
  });

  it('prints help without asking the running app', async () => {
    expect(await runSnapshot(['--help'])).toBe(0);
    expect(asked).not.toHaveBeenCalled();
    expect(print.mock.calls[0]?.[0]).toContain('timetrack-snapshot.mts --compare <file>');
  });
});
