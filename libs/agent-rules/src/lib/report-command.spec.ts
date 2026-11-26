import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReport, parsePeriod, reportCommand } from './report-command';
import { git, tempGitRepo } from './git-test-env.fixtures';

const ROWS = `| ID | Kurzname | Was | Stand | Was fehlt / wo es hakt | Wer |
| - | - | - | - | - | - |
| B1 | Alpha | a | ✅ | - | Builder |
| B2 | Beta | b | ⏸️ | Wartet auf den Menschen \\| mit Pipe. Zweiter Satz. | Builder |
| B3 |  | c | ⏳ | offen. | Builder |
`;

const commit = (dir: string, subject: string, date: string) => {
  writeFileSync(join(dir, 'file.txt'), `${subject}${date}`);
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', subject, '--date', date);
};

const noCi = () => null;

describe('parsePeriod', () => {
  const now = new Date(2026, 10, 18, 14, 30);

  it('defaults to today', () => {
    expect(parsePeriod([], now)).toEqual({ from: new Date(2026, 10, 18), to: now });
  });

  it('resolves yesterday and week', () => {
    expect(parsePeriod(['yesterday'], now)).toEqual({ from: new Date(2026, 10, 17), to: now });
    expect(parsePeriod(['week'], now)).toEqual({ from: new Date(now.getTime() - 7 * 86400000), to: now });
  });

  it('reads --since and --until', () => {
    expect(parsePeriod(['--since', '2026-11-10', '--until', '2026-11-12T10:00:00'], now)).toEqual({
      from: new Date(2026, 10, 10),
      to: new Date('2026-11-12T10:00:00'),
    });
  });

  it('reports bad input', () => {
    expect(parsePeriod(['--since', 'nope'], now)).toHaveProperty('error');
    expect(parsePeriod(['--until', '2026-11-10'], now)).toHaveProperty('error');
    expect(parsePeriod(['month'], now)).toHaveProperty('error');
    expect(parsePeriod(['today', '--since', '2026-11-10'], now)).toHaveProperty('error');
  });
});

describe('buildReport', () => {
  let dir: string;
  const from = new Date('2026-11-18T00:00:00');
  const to = new Date('2026-11-18T23:00:00');

  beforeEach(() => {
    dir = tempGitRepo('report-');
    mkdirSync(join(dir, 'plans'));
    writeFileSync(join(dir, 'plans', 'rows.md'), ROWS);
    writeFileSync(join(dir, 'plans', 'queue.md'), '1. **Gamma (B4)** ⏳ text - Builder\n');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const seed = () => {
    commit(dir, 'feat(x): Old work (B9)', '2026-11-10T10:00:00');
    commit(dir, 'feat(x): Add alpha (B1)', '2026-11-18T08:00:00');
    commit(dir, 'docs(repo): Mark alpha built (B1)', '2026-11-18T08:30:00');
    commit(dir, 'fix(x): Fix alpha edge (B1)', '2026-11-18T09:00:00');
    commit(dir, 'feat(x): Build gamma (B4)', '2026-11-18T10:00:00');
    commit(dir, 'revert(x): Undo gamma (B4)', '2026-11-18T11:00:00');
    commit(dir, 'fix(x): Loose fix', '2026-11-18T12:00:00');
    commit(dir, 'docs(repo): Queue beta (B2)', '2026-11-18T12:30:00');
    commit(dir, 'feat(x): Build unknown (B7, B3)', '2026-11-18T13:00:00');
    commit(dir, 'feat(x): Name every row (Kurznamen, B5)', '2026-11-18T14:00:00');
  };

  const sha = (subject: string) => git(dir, 'log', '--format=%h', `--grep=${subject}`, '-1');

  it('prints the exact table, parked section and figures', () => {
    seed();
    const report = buildReport({ root: dir, from, to, planFiles: ['plans/*.md'], ci: () => ({ failed: 2, total: 5 }) });

    expect(report).toBe(
      [
        '## Bericht 2026-11-18 00:00 – 2026-11-18 23:00',
        '',
        '| Zeile | Commit | Ergebnis |',
        '| - | - | - |',
        `| Alpha (B1) | ${sha('Fix alpha')} +1 | Fix alpha edge |`,
        `| Gamma (B4) | ${sha('Undo gamma')} +1 | Zurückgenommen: Undo gamma |`,
        `| B3 | ${sha('Build unknown')} | Build unknown |`,
        `| B7 | ${sha('Build unknown')} | Build unknown |`,
        `| B5 | ${sha('Name every row')} | Name every row |`,
        '',
        '**Geparkt**',
        '| Zeile | Grund |',
        '| - | - |',
        '| Beta (B2) | Wartet auf den Menschen \\| mit Pipe. |',
        '',
        '**Kennzahlen:** 9 Commits (4 feat, 2 fix, 1 revert, 2 docs) · 1 Revert · 1 ohne Zeile · CI 2/5 rot',
      ].join('\n'),
    );
  });

  it('works from git alone without config', () => {
    seed();
    const report = buildReport({ root: dir, from, to, planFiles: [], ci: noCi });

    expect(report).toContain('| B1 |');
    expect(report).not.toContain('**Geparkt**');
    expect(report).toContain('CI: n/a');
    expect(report).not.toContain('Slice');
    expect(report).not.toContain('Subagenten');
  });

  it('prints the empty period', () => {
    commit(dir, 'feat(x): Old (B1)', '2026-11-01T10:00:00');
    const report = buildReport({ root: dir, from, to, planFiles: ['plans/rows.md'], ci: noCi });

    expect(report).toContain('Keine Commits im Zeitraum.');
    expect(report).toContain('**Kennzahlen:** 0 Commits · CI: n/a');
  });

  it('does not count a docs-only row as done', () => {
    commit(dir, 'docs(repo): Queue beta (B2)', '2026-11-18T12:30:00');
    const report = buildReport({ root: dir, from, to, planFiles: [], ci: noCi });

    expect(report).toContain('Keine fertigen Zeilen im Zeitraum.');
    expect(report).not.toContain('| Zeile | Commit |');
  });

  it('shows subagent starts and the running slice when their files exist', () => {
    commit(dir, 'feat(x): Add alpha (B1)', '2026-11-18T08:00:00');
    mkdirSync(join(dir, '.git', 'ethlete'));
    writeFileSync(
      join(dir, '.git', 'ethlete', 'subagent-starts.jsonl'),
      [
        { time: '2026-11-18T07:00:00', model: 'sonnet' },
        { time: '2026-11-18T08:00:00', model: 'sonnet' },
        { time: '2026-11-18T09:00:00', model: 'haiku' },
        { time: '2026-11-01T09:00:00', model: 'opus' },
      ]
        .map((entry) => JSON.stringify(entry))
        .concat('not json')
        .join('\n'),
    );
    writeFileSync(
      join(dir, '.git', 'slice-paths'),
      '# slice: Mein Slice (B1)\n# written: 2026-11-18T09:15:00\nlibs/x\n',
    );

    const report = buildReport({ root: dir, from, to, planFiles: [], ci: noCi });

    expect(report).toContain('Subagenten: sonnet 2, haiku 1');
    expect(report).toContain('Slice läuft: Mein Slice (B1) seit 09:15');
  });
});

describe('reportCommand', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects an invalid period', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(reportCommand({ root: process.cwd(), argv: ['--since', 'nope'], ci: noCi })).toBe(1);
    expect(error).toHaveBeenCalled();
  });

  it('prints the report and falls back to CI n/a when gh fails', () => {
    const dir = tempGitRepo('report-cmd-');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      expect(reportCommand({ root: dir, argv: ['week'], ci: noCi })).toBe(0);
      expect(log.mock.calls[0]?.[0]).toContain('CI: n/a');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
