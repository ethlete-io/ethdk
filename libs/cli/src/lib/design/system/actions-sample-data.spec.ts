import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

const scans = vi.hoisted(() => ({
  design: [] as { name: string; action: string | null; owner?: string }[],
  app: [] as string[],
}));

vi.mock('../browser', () => ({ chromiumOf: async () => true }));
vi.mock('../serve', () => ({
  createDesignServer: async () => ({
    listen: async () => undefined,
    close: async () => undefined,
    httpServer: { address: () => ({ port: 1 }) },
    shotStore: () => undefined,
    ssrLoadModule: async () => ({ default: { states: { rest: {} } } }),
  }),
}));
vi.mock('./system-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system-modules')>()),
  createSystemModules: () => ({}),
}));

const elementsOf = (named: { name: string; action: string | null }[]) => {
  const counts = new Map<string, number>();

  return named.map(({ name, action }, probe) => {
    const at = name.indexOf(' "');
    const key = `${name.slice(0, at)} ${name.slice(at + 1).replace(/\s+/g, '')}`;
    const occurrence = counts.get(key) ?? 0;

    counts.set(key, occurrence + 1);

    return { key, name, occurrence, probe, action, control: null };
  });
};

const fakePage = () => {
  let side: 'design' | 'app' = 'app';

  return {
    goto: async () => void (side = 'app'),
    setContent: async () => void (side = 'design'),
    evaluate: async (script: string) =>
      script.includes('data-et-action-probe') && script.includes('found.push')
        ? elementsOf(side === 'design' ? scans.design : scans.app.map((name) => ({ name, action: null })))
        : script.includes('data-et-part') && side === 'design'
          ? Object.fromEntries(scans.design.flatMap(({ owner }, probe) => (owner ? [[String(probe), [owner]]] : [])))
          : {},
    mouse: { move: async () => undefined },
    locator: () => ({
      first: () => ({ waitFor: async () => undefined, count: async () => 0 }),
      waitFor: async () => undefined,
    }),
  };
};

vi.mock('../shot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shot')>()),
  createPartShooter: () => ({
    close: async () => undefined,
    pictureOf: async () => ({ markup: '<div></div>', png: Buffer.alloc(0), marks: [] }),
  }),
}));
vi.mock('../thumb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../thumb')>()),
  createDrawQueue: () => ({
    close: async () => undefined,
    run: async (job: (browser: unknown) => unknown) =>
      job({ newContext: async () => ({ newPage: async () => fakePage(), close: async () => undefined }) }),
  }),
}));
vi.mock('./pointer-focus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pointer-focus')>()),
  probePointerFocus: async () => null,
}));

import { checkActions } from './actions-command';

const fixturesOf = (source: string) => {
  const file = join(mkdtempSync(join(tmpdir(), 'et-sample-values-')), 'fixtures.ts');

  writeFileSync(file, source);

  return file;
};

const FIXTURES = fixturesOf(`export const PRODUCT = 'farn';\nexport const OPEN_POINTS = 48;\n`);

const failuresOf = async (design: typeof scans.design, app: string[], fixtures: string | null = FIXTURES) => {
  scans.design = design;
  scans.app = app;

  const result = await checkActions({
    target: '/tmp/none',
    config: {} as never,
    product: { name: 'app-a', config: {}, presets: {}, parts: [], fixtures } as never,
    part: 'components/title-bar',
    url: 'http://localhost:9',
    only: null,
  });

  if (typeof result === 'string') throw new Error(result);

  return result.lines.flatMap((line) => (line.failure ? [`${line.element}: ${line.failure}`] : []));
};

describe('checkActions with design sample data', () => {
  it('pairs a name that differs in a sample value the product declares and fails one that differs in another word', async () => {
    const failures = await failuresOf(
      [
        { name: 'button "Suchen in farn"', action: 'opens:components/title-search' },
        { name: 'button "Kommentar senden"', action: 'opens:components/comment-draft' },
      ],
      ['button "Suchen in studio"', 'button "Kommentar löschen"'],
    );

    expect(failures).toEqual([
      'button "Kommentar löschen": ACCESSIBLE-NAME: the design names it button "Kommentar senden", the app names it button "Kommentar löschen"',
    ]);
  });

  it('fails a one-word difference when the product declares no sample data', async () => {
    const failures = await failuresOf(
      [{ name: 'button "Suchen in farn"', action: 'opens:components/title-search' }],
      ['button "Suchen in studio"'],
      null,
    );

    expect(failures).toHaveLength(1);
  });

  it('pairs the elements whose names differ only in the sample data the design draws', async () => {
    const failures = await failuresOf(
      [
        { name: 'button "Suchen in farn"', action: 'opens:components/title-search' },
        { name: 'button "48 offen"', action: 'opens:components/open-points' },
        { name: 'button "Kommentar"', action: 'opens:components/comment-draft' },
      ],
      ['button "Suchen in studio"', 'button "3 offen"', 'button "Kommentar"'],
    );

    expect(failures).toEqual([]);
  });

  it('leaves the app rows of a list the embedded parts draw with other sample data to those parts', async () => {
    const failures = await failuresOf(
      [
        { name: 'treeitem "Components"', action: null, owner: 'components/tree-row' },
        { name: 'treeitem "shop-bar"', action: null, owner: 'components/tree-row' },
        { name: 'treeitem "product-card"', action: null, owner: 'components/tree-row' },
        { name: 'button "farn"', action: null, owner: 'components/shell-system-picker' },
        { name: 'button "H human vor 1 Std In den Korb"', action: null, owner: 'components/comment-row' },
      ],
      [
        'treeitem "Components"',
        'treeitem "select"',
        'treeitem "button"',
        'treeitem "tree-row"',
        'button "studio"',
        'button "H human vor 1 Std Tonal wirkt neben filled zu blass"',
      ],
    );

    expect(failures).toEqual([]);
  });

  it('still fails an action the app does not draw and a name the app changed', async () => {
    const failures = await failuresOf(
      [
        { name: 'button "Suchen in farn"', action: 'opens:components/title-search' },
        { name: 'button "Löschen"', action: 'opens:components/confirm' },
        { name: 'button "Senden"', action: 'opens:components/comment-draft' },
      ],
      ['button "Suchen in studio"', 'button "Absenden"'],
    );

    expect(failures).toEqual([
      'button "Löschen": the design declares opens:components/confirm but the app draws no such element',
      'button "Senden": the design declares opens:components/comment-draft but the app draws no such element',
      'button "Absenden": the design draws no element of this name - it draws button "Löschen", button "Senden": the accessible names differ',
    ]);
  });
});
