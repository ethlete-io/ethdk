import { spawn } from 'child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { gitResult } from '../git-repo.fixtures';
import { resolveProduct } from '../resolve-product';
import { originOf } from '../write-origin';
import { createSketch, decideSketch, findSketch, markSketchReady, Sketch } from './sketch';

const PART = 'elements/hero';
const CHILD = resolve(__dirname, 'merge-journal.child.ts');
const KILL = pathToFileURL(resolve(__dirname, 'merge-journal.kill.ts')).href;
const JITI = pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href;

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const pickedCase = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-merge-journal-'));
  const git = (...args: string[]) => gitResult(target, ...args);

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');
  git('init', '-q');
  git('add', '.');
  git('commit', '-qm', 'base');

  const created = createSketch({
    product: productOf(target),
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b'],
  }) as Sketch;

  writeFileSync(join(created.dir, 'b', 'elements', 'hero', 'hero.css'), '.acme-hero { color: var(--acme-accent); }');

  const ready = markSketchReady({ checkout: target, sketch: created }) as Sketch;

  decideSketch({ sketch: ready, decision: { kind: 'pick', variant: 'b', ...originOf('designer') } });

  return target;
};

const filesOf = (dir: string, root: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const rel = relative(root, path);

    if (rel === '.git' || rel === join('.ethlete', 'cache')) return [];

    return statSync(path).isDirectory() ? filesOf(path, root) : [rel];
  });

const stateOf = (target: string) => {
  const git = (...args: string[]) => gitResult(target, ...args).stdout.trim();
  const files = filesOf(target, target)
    .sort()
    .map((file) => `${file}\n${readFileSync(join(target, file), 'utf8').replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/gu, 'T')}`);

  return {
    files,
    commits: git('rev-list', '--count', 'HEAD'),
    last: git('show', '--name-status', '--format=%s', 'HEAD'),
    staged: git('diff', '--cached', '--name-only'),
  };
};

const runChild = (target: string, killAt: number) =>
  new Promise<{ out: string; killed: boolean }>((done) => {
    const child = spawn(process.execPath, ['--import', JITI, '--import', KILL, CHILD, target, String(killAt), PART], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';

    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.on('close', (code, signal) => done({ out: `${out}exit ${code}`, killed: signal === 'SIGKILL' }));
  });

const recover = (target: string) =>
  findSketch({ productDir: productOf(target).dir, product: 'acme', sketch: { layer: 'elements', name: 'hero' } });

describe('a merge killed at any write leaves the old or the new state', { timeout: 600_000 }, () => {
  it('is undone or finished by the next process, and a re-run merges or reports the sketch gone', async () => {
    const reference = pickedCase();
    const done = await runChild(reference, 0);
    const steps = Number(/writes (\d+)/u.exec(done.out)?.[1]);

    expect(done.out).toContain(`merged ${PART}`);
    expect(steps).toBeGreaterThan(5);

    const fresh = stateOf(reference);
    const outcomes: string[] = [];

    const killAt = async (step: number) => {
      const target = pickedCase();
      const old = stateOf(target);
      const killed = await runChild(target, step);

      expect(killed.killed, `step ${step}: ${killed.out}`).toBe(true);

      recover(target);

      const after = stateOf(target);
      const isOld = JSON.stringify(after) === JSON.stringify(old);

      if (!isOld) expect(after, `step ${step} is neither the old nor the new state`).toEqual(fresh);

      const rerun = await runChild(target, 0);

      expect(rerun.out, `step ${step} re-run`).toContain(isOld ? `merged ${PART}` : `no sketch ${PART}`);
      expect(stateOf(target), `step ${step} after the re-run`).toEqual(fresh);
      expect(recover(target)).toBeNull();
      outcomes.push(`${step}:${isOld ? 'old' : 'new'}`);
    };

    const queue = Array.from({ length: steps }, (_, index) => index + 1);
    const worker = async () => {
      for (let step = queue.shift(); step !== undefined; step = queue.shift()) await killAt(step);
    };

    await Promise.all(Array.from({ length: 4 }, worker));

    expect(outcomes).toHaveLength(steps);
    expect(outcomes.some((outcome) => outcome.endsWith('new'))).toBe(true);
    expect(outcomes.some((outcome) => outcome.endsWith('old'))).toBe(true);
  });
});
