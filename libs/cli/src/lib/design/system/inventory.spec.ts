import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { inventoryAnswer } from '../studio-api';
import { SeenFrame } from './complete';
import { Inventory, inventoryFramesOf } from './inventory';

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

describe('inventoryFramesOf', () => {
  it('numbers declared, undeclared and unclassified controls top to bottom, once across frames', () => {
    const box = (y: number) => ({ x: 0, y, width: 10, height: 10 });
    const frame = (state: string, extra: SeenFrame['found'] = []): SeenFrame => ({
      state,
      interaction: null,
      controls: [{ id: 'more', forced: [], box: box(50) }],
      surfaces: [],
      found: [
        {
          kind: 'control',
          what: 'button',
          path: 'main > button',
          label: 'Mehr',
          marked: 'more',
          within: ['more'],
          box: box(50),
        },
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
        label: 'Mehr',
        surfaces: ['body'],
        owner: null,
        states: 2,
        box: box(50),
        covered: false,
      },
    ]);
  });

  // A control inside an embedded part belongs to that part.
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

  // Inventory controls are keyed on path plus label.
  it('numbers two controls at the same path apart by their label, once across frames', () => {
    const owned = (label: string) => ({
      kind: 'control' as const,
      what: 'button',
      path: 'div.card > button',
      label,
      marked: 'button',
      within: ['button'],
      owner: 'components/button',
    });
    const found = (label: string) => ({
      kind: 'unclassified' as const,
      what: 'li with cursor: pointer',
      path: 'ul > li',
      label,
      marked: null,
      within: [],
    });
    const frame = (state: string, found: SeenFrame['found']): SeenFrame => ({
      state,
      interaction: null,
      controls: [],
      surfaces: [],
      found,
    });
    const frames = inventoryFramesOf({
      product: 'app-a',
      part: 'pages/start',
      controls: undefined,
      frames: [
        frame('no-repo', [owned('Repo öffnen'), found('Erste')]),
        frame('no-products', [owned('Prompt kopieren'), found('Zweite')]),
      ],
      addresses: [
        { state: 'no-repo', preset: 'desktop', width: null },
        { state: 'no-products', preset: 'desktop', width: null },
      ],
    });

    expect(frames.map((shown) => shown.controls.map(({ number, label }) => [number, label]))).toEqual([
      [
        [1, 'Repo öffnen'],
        [2, 'Erste'],
      ],
      [
        [3, 'Prompt kopieren'],
        [4, 'Zweite'],
      ],
    ]);
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

describe('inventoryFramesOf declared labels', () => {
  it('takes the label of a declared control from the element it marks, and none when nothing marked is found', () => {
    const frames = inventoryFramesOf({
      product: 'app-a',
      part: 'pages/home',
      controls: {
        'note-add': { kind: 'button', input: ['pointer'], part: 'components/done' },
        canvas: { kind: 'region', input: [] },
      },
      frames: [
        {
          state: 'rest',
          interaction: null,
          controls: [
            { id: 'note-add', forced: [] },
            { id: 'canvas', forced: [] },
          ],
          surfaces: [],
          found: [
            {
              kind: 'control',
              what: 'button',
              path: 'a',
              label: 'Notiz anlegen',
              marked: 'note-add',
              within: ['note-add'],
            },
          ],
        },
      ],
      addresses: [{ state: 'rest', preset: 'desktop', width: null }],
    });

    expect(frames[0]?.controls.map(({ id, label }) => [id, label])).toEqual([
      ['note-add', 'Notiz anlegen'],
      ['canvas', null],
    ]);
  });
});

describe('inventoryFramesOf items', () => {
  // The inventory lists assets and open overlays as owned by a foundation or part, and as a finding when inline or mocked.
  it('numbers assets and overlays per kind and marks the ownerless ones as findings', () => {
    const item = (kind: 'asset' | 'overlay', y: number, owner: string | null) => ({
      kind,
      what: kind === 'asset' ? 'svg' : 'div',
      path: `main > ${kind}${y}`,
      label: null,
      owner,
      box: { x: 0, y, width: 10, height: 10 },
    });
    const frames = inventoryFramesOf({
      product: 'app-a',
      part: 'pages/home',
      controls: undefined,
      frames: [
        {
          state: 'rest',
          interaction: null,
          controls: [],
          surfaces: [],
          items: [
            item('overlay', 30, null),
            item('asset', 20, 'foundations/logo'),
            item('asset', 10, null),
            item('overlay', 40, 'components/menu'),
          ],
        },
      ],
      addresses: [{ state: 'rest', preset: 'desktop', width: null }],
    });

    expect(frames[0]?.items.map(({ kind, number, status, owner }) => [kind, number, status, owner])).toEqual([
      ['asset', 1, 'finding', null],
      ['asset', 2, 'owned', 'foundations/logo'],
      ['overlay', 1, 'finding', null],
      ['overlay', 2, 'owned', 'components/menu'],
    ]);
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
    expect(answer.body).toMatchObject({ part: 'pages/home', hash: 'h1' });
  });
});
