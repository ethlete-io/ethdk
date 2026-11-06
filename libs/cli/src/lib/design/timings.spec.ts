import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { designCommand } from './design-command';
import { timedPhase } from './phase-timing';
import { ResidentClient, sendRun } from './resident/client';
import { startResidentServer } from './resident/server';
import {
  checkoutCommitOf,
  overTargetLineOf,
  recordCache,
  recordRun,
  skipRunTimings,
  TimingLine,
  timingsFileOf,
  unphasedMsOf,
} from './timings';

const NO_SESSION = { CLAUDE_CODE_SESSION_ID: '', TMUX_PANE: '', ETHLETE_AGENT_ROLE: '' };

describe('recordRun', () => {
  let dir: string;
  let file: string;
  const linesOf = () =>
    readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as TimingLine);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'timings-'));
    file = join(dir, '.timings.jsonl');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('appends one line with the command, parts, session, exit and phases, and prints no PHASE line by default', async () => {
    vi.stubEnv('ETHLETE_DESIGN_PHASES', '');
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const code = await recordRun(
      {
        file,
        argv: ['sketch', 'check', 'pages/start', '--product', 'studio'],
        env: { ...NO_SESSION, CLAUDE_CODE_SESSION_ID: 'abc' },
      },
      async () => {
        await timedPhase('render-check', async () => undefined);
        timedPhase('gates', () => undefined);
        recordCache(true);
        recordCache(false);

        return 0;
      },
    );
    const printed = stderr.mock.calls.flat().join('');

    stderr.mockRestore();
    expect(code).toBe(0);
    expect(printed).not.toContain('PHASE');

    const [line, ...more] = linesOf();

    expect(more).toEqual([]);
    expect(line).toMatchObject({
      command: 'sketch check',
      args: ['check', 'pages/start', '--product', 'studio'],
      parts: ['pages/start'],
      session: { claude: 'abc', tmux: null, role: null },
      resident: false,
      exit: 0,
      cache: { hits: 1, misses: 1 },
    });
    expect(line?.phases.map((phase) => phase.name)).toEqual(['render-check', 'gates']);
    expect(Date.parse(line?.start ?? '')).not.toBeNaN();
  });

  it('prints the PHASE line to stderr only with ETHLETE_DESIGN_PHASES=1', async () => {
    vi.stubEnv('ETHLETE_DESIGN_PHASES', '1');
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await recordRun({ file, argv: ['compare'], env: NO_SESSION }, async () => timedPhase('compare-states', () => 0));
    const printed = stderr.mock.calls.flat().join('');

    stderr.mockRestore();
    expect(printed).toMatch(/^PHASE compare-states \d+\.\d\ds\n$/);
    expect(linesOf()[0]?.phases.map((phase) => phase.name)).toEqual(['compare-states']);
  });

  it('logs a failing run with its exit code, and a thrown one as exit 1', async () => {
    await expect(recordRun({ file, argv: ['compare'], env: NO_SESSION }, async () => 3)).resolves.toBe(3);
    await expect(
      recordRun({ file, argv: ['check'], env: NO_SESSION }, async () => {
        timedPhase('tsc', () => undefined);

        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(linesOf().map((line) => [line.command, line.exit, line.phases.length])).toEqual([
      ['compare', 3, 0],
      ['check', 1, 1],
    ]);
  });

  it('never fails the command when the log cannot be written', async () => {
    const write = () => {
      throw new Error('disk full');
    };

    await expect(recordRun({ file, argv: ['compare'], env: NO_SESSION, write }, async () => 0)).resolves.toBe(0);
  });

  it('writes nothing for a run another process logs', async () => {
    const write = vi.fn();

    await recordRun({ file, argv: ['compare'], env: NO_SESSION, write }, async () => {
      skipRunTimings();

      return 0;
    });

    expect(write).not.toHaveBeenCalled();
  });

  it('logs a run of the resident process under the calling session, not its own', async () => {
    vi.stubEnv('CLAUDE_CODE_SESSION_ID', 'resident');
    const server = await startResidentServer({
      token: 't',
      identity: {},
      onExit: () => undefined,
      run: ({ argv, waitedMs }) =>
        recordRun({ file, argv, resident: true }, async () => (waitedMs === undefined ? 1 : 0)),
    });
    const client: ResidentClient = {
      build: 'b',
      env: {},
      alive: () => true,
      kill: () => undefined,
      start: () => undefined,
      out: () => undefined,
      err: () => undefined,
      now: () => 0,
      sleep: async () => undefined,
      startTimeoutMs: 1000,
      pingTimeoutMs: 1000,
      stopGraceMs: 1000,
      silenceMs: 10_000,
    };

    try {
      const code = await sendRun({
        found: { pid: 1, port: server.port, checkout: dir, build: 'b', token: 't', startedAt: '' },
        asked: { argv: ['compare', 'a/b'], invocation: 'et design', env: { CLAUDE_CODE_SESSION_ID: 'caller' } },
        client,
      });

      expect(code).toBe(0);
    } finally {
      await server.close();
    }

    expect(linesOf()).toMatchObject([
      { command: 'compare', parts: ['a/b'], resident: true, session: { claude: 'caller' } },
    ]);
  });
});

describe('designCommand timings', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'timings-design-'));
    mkdirSync(join(root, '.ethlete/design'), { recursive: true });
    writeFileSync(join(root, '.ethlete/design/config.json'), '{}');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('logs a failing design command, and reports it with design timings', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(designCommand({ root, argv: ['status'], invocation: 'et design' })).resolves.toBe(2);
    await expect(designCommand({ root, argv: ['timings', '--since', '1h'], invocation: 'et design' })).resolves.toBe(0);

    const lines = readFileSync(timingsFileOf(root), 'utf8').trim().split('\n');
    const report = log.mock.calls.flat().join('\n');

    error.mockRestore();
    log.mockRestore();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({ command: 'status', exit: 2 });
    expect(report).toContain('1 design runs since');
    expect(report).toContain('status');
  });
});

describe('unphasedMsOf', () => {
  it('counts the time no phase covers, nested and overlapping phases once', () => {
    expect(
      unphasedMsOf(
        [
          { name: 'resident-queue-wait', ms: 500, at: -500 },
          { name: 'harness-start', ms: 100, at: 0 },
          { name: 'compare-states', ms: 5000, at: 200 },
          { name: 'compare-app-shots', ms: 4000, at: 1000 },
          { name: 'compare-actions', ms: 600, at: 7600 },
          { name: 'draw-queue-wait', ms: 300 },
        ],
        8900,
      ),
    ).toBe(8900 - 100 - 5000 - 600);
    expect(unphasedMsOf([{ name: 'old', ms: 100 }], 1000)).toBeNull();
  });
});

describe('a run over its target', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs its unphased time and prints its slowest phase at the end of its output', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'timings-'));
    const file = join(dir, '.timings.jsonl');
    const printed: string[] = [];
    const now = vi.spyOn(performance, 'now');
    let clock = 0;

    now.mockImplementation(() => clock);
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      printed.push(String(chunk));

      return true;
    });

    await recordRun(
      { file, argv: ['compare', 'pages/sketches'], env: NO_SESSION, loadOf: () => ({ avg1: 1, cores: 8 }) },
      async () => {
        await timedPhase('compare-states', async () => {
          clock += 6_000;
        });
        clock += 5_000;
        console.error('last line of the command');

        return 1;
      },
    );

    const [line] = readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((raw) => JSON.parse(raw) as TimingLine);

    expect(line?.unphasedMs).toBe(5_000);
    expect(printed.at(-1)).toBe('over target: compare took 11.0 s > 10.0 s - slowest phase compare-states 6.0 s\n');
    rmSync(dir, { recursive: true, force: true });
  });

  it('prints nothing within its target', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'timings-'));
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await recordRun(
      { file: join(dir, '.timings.jsonl'), argv: ['compare', 'pages/start'], env: NO_SESSION },
      async () => 0,
    );

    expect(write.mock.calls.flat().join('')).not.toContain('over target');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('the commit and load of a run', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'timings-commit-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('logs the commit of the checkout the timings file is in, and the load and cores when the run ended', async () => {
    const file = timingsFileOf(dir);
    const asked: string[] = [];

    mkdirSync(join(dir, '.ethlete/design'), { recursive: true });
    await recordRun(
      {
        file,
        argv: ['compare', 'pages/start'],
        env: NO_SESSION,
        commitOf: async (checkout) => (asked.push(checkout), { sha: 'abc1234', dirty: true }),
        loadOf: () => ({ avg1: 3.5, cores: 12 }),
      },
      async () => 0,
    );

    const line = JSON.parse(readFileSync(file, 'utf8')) as TimingLine;

    expect(asked).toEqual([dir]);
    expect(line.commit).toEqual({ sha: 'abc1234', dirty: true });
    expect(line.load).toEqual({ avg1: 3.5, cores: 12 });
  });

  it('reads the short sha of HEAD and whether a tracked file differs from it', async () => {
    const git = (...args: string[]) =>
      execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });

    expect(await checkoutCommitOf(dir)).toBeNull();

    git('init', '-q');
    writeFileSync(join(dir, 'a.txt'), 'one');
    git('add', 'a.txt');
    git('commit', '-qm', 'one');
    writeFileSync(join(dir, 'untracked.txt'), 'new');

    const sha = git('rev-parse', '--short', 'HEAD').trim();

    expect(await checkoutCommitOf(dir)).toEqual({ sha, dirty: false });

    writeFileSync(join(dir, 'a.txt'), 'two');

    expect(await checkoutCommitOf(dir)).toEqual({ sha, dirty: true });
  });

  it('says a run over its target under load above its cores is no verdict', () => {
    const line = {
      command: 'compare',
      args: ['pages/start'],
      parts: ['pages/start'],
      totalMs: 12000,
      phases: [],
      load: { avg1: 14.2, cores: 12 },
    } as unknown as TimingLine;

    expect(overTargetLineOf(line)).toBe(
      'over target: compare took 12.0 s > 10.0 s - slowest phase none recorded (noisy: load 14.2 > 12 cores, no verdict)',
    );
    expect(overTargetLineOf({ ...line, load: { avg1: 3, cores: 12 } })).toBe(
      'over target: compare took 12.0 s > 10.0 s - slowest phase none recorded',
    );
  });
});
