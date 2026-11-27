import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { CLIENT_PATHS, clientCommitsSince, dueReasonOf, lastRunOf, openRowsOfRun, RUN_RECORD } from './due.mjs';

const now = new Date(2026, 10, 27, 10, 0);
const run = (overrides = {}) => ({
  name: '2026-11-25-0236',
  startedAt: new Date(2026, 10, 25, 2, 36),
  sdkCommit: 'abc123',
  ...overrides,
});

describe('dueReasonOf', () => {
  it('is due without any run', () => {
    assert.equal(dueReasonOf({ last: null, now, clientCommits: 0 }), 'no client run yet');
  });

  it('is due once the last run is as old as the limit', () => {
    const last = run({ name: '2026-11-20-1000', startedAt: new Date(2026, 10, 20, 10, 0) });
    assert.equal(dueReasonOf({ last, now, clientCommits: 0 }), 'the last run 2026-11-20-1000 is 7 days old');
  });

  it('is due when commits after the run change what the client agent uses', () => {
    assert.equal(
      dueReasonOf({ last: run(), now, clientCommits: 4 }),
      '4 commits since 2026-11-25-0236 change what the client agent uses',
    );
  });

  it('is due when git does not know the run commit', () => {
    assert.match(
      dueReasonOf({ last: run(), now, clientCommits: null }),
      /abc123 of 2026-11-25-0236 is not in this repo/,
    );
  });

  it('is not due for a recent run on the current tool', () => {
    assert.equal(dueReasonOf({ last: run(), now, clientCommits: 0 }), null);
  });

  it('judges a recent run without a recorded commit by its age only', () => {
    assert.equal(dueReasonOf({ last: run({ sdkCommit: null }), now, clientCommits: null }), null);
  });
});

describe('lastRunOf', () => {
  const out = mkdtempSync(join(tmpdir(), 'client-run-due-'));
  after(() => rmSync(out, { recursive: true, force: true }));

  it('finds no run in a missing or empty dir', () => {
    assert.equal(lastRunOf(join(out, 'missing')), null);
    assert.equal(lastRunOf(out), null);
  });

  it('picks the newest stamped run, skips other dirs, and reads its commit', () => {
    for (const name of ['2026-11-24-1642', '2026-11-25-0236', 'b685-live']) mkdirSync(join(out, name));
    writeFileSync(join(out, '2026-11-25-0236', RUN_RECORD), JSON.stringify({ sdkCommit: 'def456' }));

    assert.deepEqual(lastRunOf(out), {
      name: '2026-11-25-0236',
      startedAt: new Date(2026, 10, 25, 2, 36),
      sdkCommit: 'def456',
    });
  });

  it('gives a run without a record no commit', () => {
    mkdirSync(join(out, '2026-11-26-0900'));
    assert.equal(lastRunOf(out).sdkCommit, null);
  });
});

describe('clientCommitsSince', () => {
  it('counts the commits after the run commit on the client paths', () => {
    const calls = [];
    const count = clientCommitsSince({
      repo: '/repo',
      sdkCommit: 'abc123',
      spawn: (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return { status: 0, stdout: '3\n' };
      },
    });
    assert.equal(count, 3);
    assert.deepEqual(calls, [
      { command: 'git', args: ['rev-list', '--count', 'abc123..HEAD', '--', ...CLIENT_PATHS], cwd: '/repo' },
    ]);
  });

  it('gives null when git fails', () => {
    assert.equal(clientCommitsSince({ repo: '/repo', sdkCommit: 'gone', spawn: () => ({ status: 128 }) }), null);
  });

  it('counts real commits of this repo', () => {
    const repo = join(import.meta.dirname, '../..');
    assert.equal(clientCommitsSince({ repo, sdkCommit: 'HEAD' }), 0);
    assert.ok(clientCommitsSince({ repo, sdkCommit: 'HEAD~200' }) > 0);
  });
});

describe('openRowsOfRun', () => {
  const queue = [
    '| ID | Zeile |',
    '| B900 | Button-Befund | Ziel | Befund aus Lauf 2026-11-25-0236 | Builder |',
    '| B901 | Anderer Lauf 2026-11-20-1000 | Ziel | Stand | Builder |',
    '| B902 | Ohne Lauf | Ziel | Stand | Builder |',
    'Geparkt: B903 Shell-Befund (Lauf 2026-11-25-0236): Text',
  ].join('\n');

  it('lists the open rows that cite the last run, table and parked', () => {
    assert.deepEqual(openRowsOfRun({ queue, runName: '2026-11-25-0236' }), ['B900', 'B903']);
  });

  it('lists nothing when no row cites the run', () => {
    assert.deepEqual(openRowsOfRun({ queue, runName: '2026-11-26-0100' }), []);
  });
});
