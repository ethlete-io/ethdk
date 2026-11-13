import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { argsOf, judgeP1, judgeP5, P1_TARGETS, p5RunOf, phasesOf, runLineOf } from './design-server-proof.mjs';

const COLD_RUN = readFileSync(join(import.meta.dirname, 'fixtures/design-server-proof/sketch-check-cold.log'), 'utf8');

const P5_PASS = readFileSync(join(import.meta.dirname, 'fixtures/design-server-proof/b498-r3-pass.log'), 'utf8');

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
