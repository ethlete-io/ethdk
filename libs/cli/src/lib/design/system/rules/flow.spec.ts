import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { ruleProblemsOf } from '../check-system';
import { listFlows } from '../flows/flow';
import { resolveProduct } from '../resolve-product';
import { flowProblemsOf } from './flow';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-flow-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const flow = (target: string, name: string, body: unknown) => {
  const dir = join(target, DESIGN_DIR, 'acme/flows');
  const file = join(dir, `${name}.json`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));

  return file;
};

const browse = {
  frames: [
    { part: 'pages/home', state: 'empty' },
    { part: 'pages/home', state: 'default', position: { x: 600, y: 0 } },
    { part: 'elements/hero', state: 'default' },
  ],
  lines: [
    { from: { part: 'pages/home', state: 'empty' }, to: { part: 'pages/home', state: 'default' }, label: 'a film' },
    { from: { part: 'pages/home', state: 'default' }, to: { part: 'elements/hero', state: 'default' } },
  ],
  notes: [{ text: 'free notes come later', position: { x: 0, y: 0 } }],
};

describe('listFlows', () => {
  it('reads each flow file by name, with its frames and lines', () => {
    const target = acme();
    const file = flow(target, 'browse', browse);

    expect(listFlows(resolveAcme(target).dir)).toEqual({
      flows: [{ name: 'browse', file, frames: browse.frames, lines: browse.lines }],
      unreadable: [],
    });
  });

  it('answers a product without flows with none', () => {
    expect(listFlows(resolveAcme(acme()).dir)).toEqual({ flows: [], unreadable: [] });
  });
});

describe('flowProblemsOf', () => {
  it('passes a flow over states that exist', () => {
    const target = acme();

    flow(target, 'browse', browse);

    expect(flowProblemsOf(resolveAcme(target))).toEqual([]);
  });

  it('fails a frame that names a missing part or state', () => {
    const target = acme();
    const file = flow(target, 'gone', {
      frames: [
        { part: 'pages/home', state: 'loading' },
        { part: 'pages/search', state: 'default' },
      ],
    });

    expect(flowProblemsOf(resolveAcme(target))).toEqual([
      { rule: 'FLOW', file, message: 'pages/home has no state "loading" - fix or drop the frame' },
      { rule: 'FLOW', file, message: 'part pages/search no longer exists - fix or drop the frame' },
    ]);
  });

  it('fails a line to a state the flow shows no frame of, and a state shown twice', () => {
    const target = acme();
    const file = flow(target, 'loose', {
      frames: [
        { part: 'pages/home', state: 'empty' },
        { part: 'pages/home', state: 'empty' },
      ],
      lines: [{ from: { part: 'pages/home', state: 'empty' }, to: { part: 'pages/home', state: 'default' } }],
    });

    expect(flowProblemsOf(resolveAcme(target))).toEqual([
      { rule: 'FLOW', file, message: 'shows pages/home "empty" twice - a state is one frame per flow' },
      {
        rule: 'FLOW',
        file,
        message: 'lines[0] names pages/home "default", which is no frame of the flow - add it to frames',
      },
    ]);
  });

  it('fails a flow file of the wrong shape or no JSON', () => {
    const target = acme();
    const shape = flow(target, 'a-shape', { frames: [{ part: 'pages/home' }] });
    const label = flow(target, 'b-label', {
      frames: [],
      lines: [{ from: { part: 'a', state: 'b' }, to: { part: 'a', state: 'c' }, label: 3 }],
    });
    const json = flow(target, 'c-json', '{');

    expect(flowProblemsOf(resolveAcme(target))).toEqual([
      { rule: 'FLOW', file: shape, message: 'frames[0] must be { part: "<layer>/<name>", state, position? }' },
      { rule: 'FLOW', file: label, message: 'lines[0] must be { from: { part, state }, to: { part, state }, label? }' },
      { rule: 'FLOW', file: json, message: expect.stringMatching(/^is no JSON: /) },
    ]);
  });

  it('runs under et design check', () => {
    const target = acme();

    flow(target, 'gone', { frames: [{ part: 'pages/home', state: 'loading' }] });

    expect(ruleProblemsOf(resolveAcme(target)).map((problem) => problem.rule)).toContain('FLOW');
  });
});
