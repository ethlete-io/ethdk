import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  argsOf,
  judgeP1,
  judgeP2,
  judgeP3,
  judgeP4,
  judgeP5,
  judgeP6,
  ownersOf,
  P1_TARGETS,
  p2RunOf,
  p5RunOf,
  phasesOf,
  psRowsOf,
  runLineOf,
  slowWindowOf,
  vitestTotalsOf,
  worstBlockOf,
} from './design-server-proof.mjs';

const COLD_RUN = readFileSync(join(import.meta.dirname, 'fixtures/design-server-proof/sketch-check-cold.log'), 'utf8');

const P5_PASS = readFileSync(join(import.meta.dirname, 'fixtures/design-server-proof/b498-r3-pass.log'), 'utf8');

const fixture = (name) => readFileSync(join(import.meta.dirname, 'fixtures/design-server-proof', name), 'utf8');

const run = (ms, ok = true) => ({ ms, ok, status: ok ? 0 : 1, phases: [] });

describe('phasesOf', () => {
  it('reads the PHASE lines of a captured cold sketch check, in order', () => {
    const phases = phasesOf(COLD_RUN);

    assert.deepEqual(
      phases.map((phase) => phase.name),
      [
        'gates',
        'tsc a',
        'tsc b',
        'aktuell',
        'browser-start',
        'render-check',
        'load',
        'mark-drift',
        'identical',
        'changes-shot',
      ],
    );
    assert.deepEqual(phases[0], { name: 'gates', ms: 12_900 });
    assert.deepEqual(phases[5], { name: 'render-check', ms: 3750 });
  });

  it('ignores the over-target line and the NOTE lines', () => {
    assert.equal(
      phasesOf('over target: sketch check took 19.9 s > 10.0 s - slowest phase gates 12.9 s\nNOTE x').length,
      0,
    );
  });
});

describe('judgeP1', () => {
  it('passes a cold run and three warm runs within the targets', () => {
    assert.deepEqual(judgeP1([run(9_900), run(4_000), run(5_000), run(3_500)]), { pass: true, failures: [] });
  });

  it('names each run over its target', () => {
    const verdict = judgeP1([run(19_300), run(7_000), run(4_900), run(5_100)]);

    assert.equal(verdict.pass, false);
    assert.deepEqual(verdict.failures, ['cold 19.3 s > 10.0 s', 'warm 1 7.0 s > 5.0 s', 'warm 3 5.1 s > 5.0 s']);
  });

  it('fails a run that exited non-zero, however fast, and too few warm runs', () => {
    const verdict = judgeP1([run(3_000), run(1_000, false)]);

    assert.equal(verdict.pass, false);
    assert.deepEqual(verdict.failures, [
      `1 warm runs, need ${P1_TARGETS.warmRuns}`,
      'warm 1 1.0 s > 5.0 s',
      'run 2 exited 1',
    ]);
  });
});

describe('runLineOf', () => {
  it('shows the wall time and the three slowest phases', () => {
    const line = runLineOf('cold', { ...run(20_120), phases: phasesOf(COLD_RUN) });

    assert.equal(line, '  cold     20.1 s  gates 12.9 s, render-check 3.8 s, tsc a 1.0 s');
  });
});

describe('argsOf', () => {
  it('defaults the CLI to the build in the target checkout', () => {
    const options = argsOf(['--target', '/tmp/copy']);

    assert.equal(options.cli, '/tmp/copy/dist/libs/cli/src/index.js');
    assert.equal(options.part, 'components/command-palette');
  });

  it('refuses an unknown flag and a flag without a value', () => {
    assert.equal(argsOf(['--fast']).code, 2);
    assert.equal(argsOf(['--part']).code, 2);
  });
});

describe('p5RunOf', () => {
  it('reads a captured passing B498 R3 run as passed with no empty cell and no ECONNRESET', () => {
    assert.deepEqual(p5RunOf(P5_PASS), { passed: true, empty: 0, resets: 0 });
  });

  it('counts empty samples, empty columns and every ECONNRESET of a failed run', () => {
    const failed = P5_PASS.replace(
      / {2}✓ (.*empty) 32 of 32 cells.*$/m,
      '  ✘ $1 3 empty samples of cells that had a picture: x; columns with no cell: a, b (44.0s)\n' +
        'Error: apiRequestContext.get: read ECONNRESET',
    );

    assert.deepEqual(p5RunOf(failed), { passed: false, empty: 5, resets: 1 });
  });

  it('reads a run without the case row as not passed', () => {
    assert.equal(p5RunOf('').passed, false);
  });
});

describe('judgeP5', () => {
  const clean = { passed: true, empty: 0, resets: 0 };

  it('passes five clean runs', () => {
    assert.deepEqual(judgeP5(Array(5).fill(clean)), { pass: true, failures: [] });
  });

  it('names each failed run, each empty cell count and each ECONNRESET, and too few runs', () => {
    const verdict = judgeP5([clean, { passed: false, empty: 2, resets: 1 }]);

    assert.equal(verdict.pass, false);
    assert.deepEqual(verdict.failures, [
      '2 runs, need 5',
      'run 2 did not pass',
      'run 2: 2 empty cells',
      'run 2: 1 ECONNRESET',
    ]);
  });
});

describe('p2RunOf', () => {
  it('reads a captured cold resident shot as a resident start, a warm one as no start', () => {
    assert.deepEqual(p2RunOf(fixture('shot-resident-cold.log')), { residentStart: true, starts: [] });
    assert.deepEqual(p2RunOf('node_modules/.design-explore/shots/studio-components-zoom-chip.png\n'), {
      residentStart: false,
      starts: [],
    });
  });

  it('reads the browser starts of a captured in-process shot', () => {
    assert.deepEqual(p2RunOf(fixture('shot-in-process.log')).starts, ['browser-start', 'browser-start']);
  });
});

describe('judgeP2', () => {
  const owners = { design: [10], roots: [20], chromium: [20, 21] };
  const shot = (ms, more = {}) => ({ ms, ok: true, status: 0, residentStart: false, starts: [], owners, ...more });

  it('passes a cold first run and four warm runs on the same processes', () => {
    assert.deepEqual(judgeP2([shot(1400, { residentStart: true }), shot(700), shot(700), shot(600), shot(700)]), {
      pass: true,
      failures: [],
    });
  });

  it('fails an in-process run 2, a slow run, a new resident and too few runs', () => {
    const inProcess = p2RunOf(fixture('shot-in-process.log'));

    assert.deepEqual(
      judgeP2([
        shot(1300, inProcess),
        shot(1200, inProcess),
        shot(2500),
        shot(700, { owners: { design: [11], roots: [22], chromium: [22] } }),
      ]).failures,
      [
        '4 runs, need 5',
        'run 2 started browser-start, browser-start',
        'run 3 2.5 s > 2.0 s',
        'run 4 drew with other processes (design 10, Chrome roots 20 -> design 11, Chrome roots 22)',
      ],
    );
  });
});

describe('ownersOf', () => {
  const rows = psRowsOf(fixture('ps-resident.txt'));
  const target = '/scratch/b499';

  it('finds the resident of the checkout, its Chromium root and every Chromium process under it', () => {
    const owners = ownersOf(rows, { target, cwdOf: (pid) => (pid === 2115016 ? target : '/elsewhere') });

    assert.deepEqual(owners.design, [2115016]);
    assert.equal(owners.roots.length, 1);
    assert.ok(owners.chromium.length > 1);
    assert.ok(owners.chromium.includes(owners.roots[0]));
  });

  it('leaves out a design process of another checkout', () => {
    assert.deepEqual(ownersOf(rows, { target, cwdOf: () => '/elsewhere' }), { design: [], roots: [], chromium: [] });
  });
});

describe('judgeP3', () => {
  it('passes one design process and one Chrome root, and names each extra one and a failed run', () => {
    assert.equal(judgeP3({ design: [1], roots: [2] }, [{ label: 'shot', ok: true }]).pass, true);
    assert.deepEqual(
      judgeP3({ design: [1, 3], roots: [2, 4] }, [{ label: 'compare x', ok: false, status: 1 }]).failures,
      ['compare x exited 1', '2 design processes', '2 Chrome roots'],
    );
  });
});

describe('judgeP4', () => {
  it('passes a resident that ran and is gone with its Chromium, and fails what is left', () => {
    const before = { design: [1], roots: [2], chromium: [2, 3] };
    const gone = { design: [], roots: [], chromium: [] };

    assert.equal(judgeP4({ run: { ok: true }, before, after: gone, alive: [] }).pass, true);
    assert.deepEqual(judgeP4({ run: { ok: true }, before, after: before, alive: [2, 3] }).failures, [
      '1 design processes left',
      '2 Chromium processes left',
    ]);
  });
});

describe('slowWindowOf', () => {
  const at = (seconds, line) => ({ at: seconds * 1000, line: `design-explore: ${line}` });

  it('spans from the first product run to the last done', () => {
    assert.deepEqual(
      slowWindowOf([
        at(1, 'listening'),
        at(30, 'slow checks: sdk components/button'),
        at(40, 'slow checks: sdk done, 0 problem(s)'),
        at(41, 'slow checks: studio pages/start'),
        at(90, 'slow checks: studio done, 30 problem(s)'),
      ]),
      { from: 30_000, to: 90_000, problems: { sdk: 0, studio: 30 } },
    );
  });

  it('is null before any run and while a started product still runs', () => {
    assert.equal(slowWindowOf([at(1, 'listening')]), null);
    assert.equal(slowWindowOf([at(30, 'slow checks: sdk components/button')]), null);
  });
});

describe('worstBlockOf', () => {
  it('takes the longest block that overlaps the window', () => {
    const blocks = [
      { at: 5_000, ms: 4_000 },
      { at: 12_000, ms: 1_500 },
      { at: 30_500, ms: 900 },
      { at: 40_000, ms: 300 },
    ];

    assert.equal(worstBlockOf(blocks, { from: 11_000, to: 30_000 }), 1_500);
    assert.equal(worstBlockOf(blocks, { from: 20_000, to: 30_000 }), 900);
    assert.equal(worstBlockOf(blocks, { from: 50_000, to: 60_000 }), 0);
  });
});

describe('judgeP6', () => {
  const window = { from: 0, to: 1 };

  it('passes within the targets and names each miss', () => {
    const ok = { systemStatus: 200, openPointsStatus: 200 };

    assert.equal(judgeP6({ window, blockMs: 16, systemWarmMs: 40, openPointsColdMs: 900, ...ok }).pass, true);
    assert.deepEqual(
      judgeP6({ window: null, blockMs: 5021, systemWarmMs: 400, openPointsColdMs: 2600, ...ok }).failures,
      [
        'no slow-checks poll ran to its end',
        'main-thread block 5021 ms > 1000 ms',
        'warm /__design/system 400 ms > 300 ms',
        'cold /__design/open-points 2600 ms > 1500 ms',
      ],
    );
  });

  it('fails a refused request, however fast it answered', () => {
    assert.deepEqual(
      judgeP6({ window, blockMs: 0, systemWarmMs: 47, systemStatus: 200, openPointsColdMs: 1, openPointsStatus: 400 })
        .failures,
      ['cold /__design/open-points answered 400'],
    );
  });
});

describe('vitestTotalsOf', () => {
  it('reads the totals of a captured passing run of the S3 specs', () => {
    assert.deepEqual(vitestTotalsOf(fixture('p7-vitest-pass.log')), { passed: 13, failed: 0 });
  });

  it('reads failed tests, and null without a totals line', () => {
    assert.deepEqual(vitestTotalsOf('      Tests  2 failed | 6 passed (8)'), { passed: 6, failed: 2 });
    assert.equal(vitestTotalsOf('Error: no config'), null);
  });
});
