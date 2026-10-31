import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { inventoryAnswer, inventoryApproveAnswer } from '../studio-api';
import { SeenFrame } from './complete';
import { Inventory, inventoryFramesOf } from './inventory';
import { inventoryStateOf, readInventory } from './inventory-approval';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-inventory-'));
  const design = join(target, DESIGN_DIR);
  const page = join(design, 'app-a', 'pages', 'home');

  mkdirSync(page, { recursive: true });
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  writeFileSync(join(page, 'home.ts'), 'export default {};\n');

  return { target, dir: join(design, 'app-a') };
};

const inventoryOf = (dir: string, findings: number): Inventory => ({
  part: 'pages/home',
  dir,
  hash: 'h1',
  ids: ['more'],
  findings,
  approval: null,
  state: { state: 'none' },
  reason: 'its control inventory is not approved',
  frames: [],
});

const ask = (options: { target: string; method: string; path: string; body?: unknown; inventory: Inventory }) => ({
  target: options.target,
  url: new URL(`http://localhost${options.path}`),
  request: Object.assign(Readable.from(options.body === undefined ? [] : [Buffer.from(JSON.stringify(options.body))]), {
    method: options.method,
  }) as unknown as IncomingMessage,
  inventoryOf: () => Promise.resolve(options.inventory),
});

describe('inventoryStateOf', () => {
  const approval = { ids: ['more', 'pick'], hash: 'h1', by: 'tom', at: '2026-10-30T00:00:00.000Z' };

  it('holds while the ids and the hash match', () => {
    expect(inventoryStateOf({ approval, ids: ['more', 'pick'], hash: 'h1' })).toEqual({ state: 'approved' });
    expect(inventoryStateOf({ approval: undefined, ids: [], hash: 'h1' })).toEqual({ state: 'none' });
  });

  it('reopens on an added id, a removed id and a part change', () => {
    expect(inventoryStateOf({ approval, ids: ['more', 'pick', 'save'], hash: 'h1' })).toEqual({
      state: 'reopened',
      added: ['save'],
      removed: [],
      changed: false,
    });
    expect(inventoryStateOf({ approval, ids: ['more'], hash: 'h1' })).toEqual({
      state: 'reopened',
      added: [],
      removed: ['pick'],
      changed: false,
    });
    expect(inventoryStateOf({ approval, ids: ['more', 'pick'], hash: 'h2' })).toEqual({
      state: 'reopened',
      added: [],
      removed: [],
      changed: true,
    });
  });
});

describe('inventoryFramesOf', () => {
  it('numbers declared, undeclared and unclassified controls top to bottom, once across frames', () => {
    const box = (y: number) => ({ x: 0, y, width: 10, height: 10 });
    const frame = (state: string, extra: SeenFrame['found'] = []): SeenFrame => ({
      state,
      interaction: null,
      controls: [{ id: 'more', forced: [], box: box(50) }],
      surfaces: [],
      found: [
        { kind: 'control', what: 'button', path: 'main > button', marked: 'more', within: ['more'], box: box(50) },
        ...extra,
      ],
    });
    const frames = inventoryFramesOf({
      product: 'app-a',
      part: 'pages/home',
      controls: {
        more: { kind: 'disclosure', input: ['pointer'], part: 'components/done', surfaces: { body: 'open' } },
      },
      frames: [
        frame('rest', [
          { kind: 'control', what: 'a', path: 'main > a', marked: null, within: [], box: box(10) },
          { kind: 'unclassified', what: 'div with cursor: pointer', path: 'main > div', marked: null, within: [] },
        ]),
        frame('open'),
        { ...frame('open'), interaction: 'hover' },
      ],
      addresses: [
        { state: 'rest', preset: 'desktop', width: null },
        { state: 'open', preset: 'desktop', width: null },
      ],
    });

    expect(frames.map(({ state, shot }) => ({ state, shot }))).toEqual([
      { state: 'rest', shot: '/__design/shot?product=app-a&part=pages%2Fhome&state=rest&preset=desktop' },
      { state: 'open', shot: '/__design/shot?product=app-a&part=pages%2Fhome&state=open&preset=desktop' },
    ]);
    expect(
      frames[0]?.controls.map(({ number, id, status, kind, states }) => [number, id, status, kind, states]),
    ).toEqual([
      [1, 'main > a', 'undeclared', 'a', 1],
      [2, 'more', 'declared', 'disclosure', 2],
      [3, 'main > div', 'unclassified', 'div with cursor: pointer', 1],
    ]);
    expect(frames[1]?.controls).toEqual([
      {
        number: 2,
        id: 'more',
        status: 'declared',
        kind: 'disclosure',
        inputs: ['pointer'],
        surfaces: ['body'],
        owner: null,
        states: 2,
        box: box(50),
      },
    ]);
  });

  it('lists the controls an embedded part draws as owned, so a page of owned buttons shows them and stays approvable', () => {
    const box = (y: number) => ({ x: 0, y, width: 10, height: 10 });
    const owned = (path: string, y: number) => ({
      kind: 'control' as const,
      what: 'button',
      path,
      marked: 'button',
      within: ['button'],
      owner: 'components/button',
      box: box(y),
    });
    const frames = inventoryFramesOf({
      product: 'app-a',
      part: 'pages/start',
      controls: undefined,
      frames: [
        {
          state: 'empty',
          interaction: null,
          controls: [],
          surfaces: [],
          found: [owned('main > et-button.open', 10), owned('main > et-button.other', 30)],
        },
      ],
      addresses: [{ state: 'empty', preset: 'desktop', width: null }],
    });

    expect(frames[0]?.controls.map(({ number, id, status, kind, owner }) => [number, id, status, kind, owner])).toEqual(
      [
        [1, 'main > et-button.open', 'owned', 'button', 'components/button'],
        [2, 'main > et-button.other', 'owned', 'button', 'components/button'],
      ],
    );
  });

  it('does not list an owned control twice inside a marked control of the page', () => {
    const frames = inventoryFramesOf({
      product: 'app-a',
      part: 'pages/home',
      controls: { picker: { kind: 'select', input: ['pointer'] } },
      frames: [
        {
          state: 'rest',
          interaction: null,
          controls: [{ id: 'picker', forced: [] }],
          surfaces: [],
          found: [
            {
              kind: 'control',
              what: 'button',
              path: 'main > button',
              marked: null,
              within: ['picker'],
              owner: 'components/select',
            },
          ],
        },
      ],
      addresses: [{ state: 'rest', preset: 'desktop', width: null }],
    });

    expect(frames[0]?.controls.map(({ id, status }) => [id, status])).toEqual([['picker', 'declared']]);
  });
});

describe('inventory endpoints', () => {
  it('answers the inventory of a page without its directory', async () => {
    const { target, dir } = checkout();
    const answer = await inventoryAnswer(
      ask({ target, method: 'GET', path: '/?product=app-a&part=pages/home', inventory: inventoryOf(dir, 0) }),
    );

    expect(answer.status).toBe(200);
    expect(answer.body).not.toHaveProperty('dir');
    expect(answer.body).toMatchObject({ part: 'pages/home', hash: 'h1', state: { state: 'none' } });
  });

  it('refuses to approve a page with an undeclared or unclassified control, or a hash that changed', async () => {
    const { target, dir } = checkout();
    const approve = (body: unknown, findings: number) =>
      inventoryApproveAnswer(
        ask({ target, method: 'POST', path: '/?product=app-a', body, inventory: inventoryOf(dir, findings) }),
      );

    expect(await approve({ part: 'pages/home', hash: 'h1', by: 'tom' }, 1)).toEqual({
      status: 422,
      body: { error: 'pages/home has 1 undeclared or unclassified control(s) - declare them before approving' },
    });
    expect((await approve({ part: 'pages/home', hash: 'h0', by: 'tom' }, 0)).status).toBe(409);
    expect((await approve({ part: 'pages/home', hash: 'h1' }, 0)).status).toBe(400);
    expect(readInventory(dir)).toEqual({});
  });

  it('writes the ids, the hash and who approved them', async () => {
    const { target, dir } = checkout();
    const answer = await inventoryApproveAnswer(
      ask({
        target,
        method: 'POST',
        path: '/?product=app-a',
        body: { part: 'pages/home', hash: 'h1', by: 'tom' },
        inventory: inventoryOf(dir, 0),
      }),
    );

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ state: { state: 'approved' }, reason: null });
    expect(readInventory(dir)).toEqual({
      'pages/home': { ids: ['more'], hash: 'h1', by: 'tom', at: expect.any(String) },
    });
  });
});
