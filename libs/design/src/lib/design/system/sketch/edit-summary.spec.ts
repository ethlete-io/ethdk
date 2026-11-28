import { describe, expect, it } from 'vitest';
import { shownSketchRowsOf } from '../../sketch-frame-set';
import { editNoteOf, editStatesOf, withEditUnchanged } from './edit-summary';
import { Sketch } from './sketch';

const PART = 'elements/variant-cell';
const SHARED = ['changed', 'unchanged', 'same-as-rest', 'loading', 'loading-small', 'cropped', 'stacked', 'pinned'];

const variantCellTargets = () => [
  { part: PART, variant: 'new', states: SHARED, unchanged: [] as string[], changes: { added: [], dropped: [] } },
  {
    part: PART,
    variant: 'old',
    states: [...SHARED.slice(0, 5), 'selected', ...SHARED.slice(5)],
    unchanged: SHARED,
    changes: { added: ['selected'], dropped: [] },
  },
];

const editSketch = { target: `${PART}@edit`, layer: 'elements', name: 'variant-cell' } as Sketch;

const rowsOf = (targets: ReturnType<typeof variantCellTargets>) =>
  targets.map((entry) => ({
    key: entry.variant,
    shots: entry.states.map((state) => ({ state, changed: !entry.unchanged.includes(state) })),
  }));

describe('withEditUnchanged', () => {
  it('folds the states old and new of variant-cell@edit draw alike, leaving the dropped selected', () => {
    const shown = shownSketchRowsOf({ listed: rowsOf(withEditUnchanged(editSketch, variantCellTargets())) });

    expect(shown.map((row) => [row.key, row.shots.map((shot) => shot.state)])).toEqual([
      ['new', []],
      ['old', ['selected']],
    ]);
  });

  it('gives new the states old has not compared yet as pending, and none it adds itself', () => {
    const [created, old] = variantCellTargets();
    const targets: (NonNullable<typeof created> & { pending?: string[] })[] = [
      { ...(created as NonNullable<typeof created>), states: [...SHARED, 'added'], pending: ['added'] },
      { ...(old as NonNullable<typeof old>), unchanged: SHARED.slice(0, 2), pending: SHARED.slice(2) },
    ];

    expect(withEditUnchanged(editSketch, targets)[0]).toMatchObject({
      variant: 'new',
      unchanged: SHARED.slice(0, 2),
      pending: SHARED.slice(2),
    });
  });

  it('leaves the targets of any other sketch as they are', () => {
    const targets = variantCellTargets();
    const sketch = { ...editSketch, target: `${PART}@other` } as Sketch;

    expect(withEditUnchanged(sketch, targets)).toBe(targets);
  });
});

const TREE_ROW = 'components/tree-row';
const TREE_ROW_STATES = ['tree', 'leaf', 'hover', 'selected', 'mark-layer', 'selected-layer', 'group-closed'];
const treeRowSketch = { target: `${TREE_ROW}@edit`, layer: 'components', name: 'tree-row' } as Sketch;

const listedRowsOf = (targets: { variant: string; states: string[]; unchanged?: string[] | undefined }[]) =>
  targets.map((entry) => ({
    key: entry.variant,
    shots: entry.states.map((state) => ({
      state,
      changed: entry.unchanged ? !entry.unchanged.includes(state) : null,
    })),
  }));

describe('the tree-row@edit view while old is compared', () => {
  const quickListing = () => [
    { part: TREE_ROW, variant: 'new', states: TREE_ROW_STATES, unchanged: [] as string[] },
    { part: TREE_ROW, variant: 'old', states: TREE_ROW_STATES },
  ];

  it('keeps new pending like old instead of every state changed', () => {
    const rows = listedRowsOf(withEditUnchanged(treeRowSketch, quickListing()));

    expect(rows.map((row) => [row.key, row.shots.map((shot) => shot.changed)])).toEqual([
      ['new', TREE_ROW_STATES.map(() => null)],
      ['old', TREE_ROW_STATES.map(() => null)],
    ]);
  });

  it('draws no cell before the compare answers, then only the changed states', () => {
    const pending = shownSketchRowsOf({ listed: listedRowsOf(withEditUnchanged(treeRowSketch, quickListing())) });
    const unchanged = TREE_ROW_STATES.filter((state) => !state.endsWith('-layer'));
    const answered = quickListing().map((entry) => (entry.variant === 'old' ? { ...entry, unchanged } : entry));
    const compared = shownSketchRowsOf({ listed: listedRowsOf(withEditUnchanged(treeRowSketch, answered)) });

    expect(pending.map((row) => [row.key, row.shots.length])).toEqual([
      ['new', 0],
      ['old', 0],
    ]);
    expect(compared.map((row) => [row.key, row.shots.map((shot) => shot.state)])).toEqual([
      ['new', ['mark-layer', 'selected-layer']],
      ['old', ['mark-layer', 'selected-layer']],
    ]);
  });
});

describe('the change marks of tree-row@edit', () => {
  it('gives new the changed areas old measured against it', () => {
    const area = { width: 280, height: 46, box: { x: 240, y: 14, width: 18, height: 18 }, pixels: 120, regions: 1 };
    const unchanged = TREE_ROW_STATES.filter((state) => !state.endsWith('-layer'));
    const targets = withEditUnchanged(treeRowSketch, [
      { part: TREE_ROW, variant: 'new', states: TREE_ROW_STATES, unchanged: [] as string[] },
      {
        part: TREE_ROW,
        variant: 'old',
        states: TREE_ROW_STATES,
        unchanged,
        crops: { 'mark-layer': area, 'selected-layer': area },
      },
    ]);

    expect(targets.map((entry) => [entry.variant, entry.crops])).toEqual([
      ['new', { 'mark-layer': area, 'selected-layer': area }],
      ['old', { 'mark-layer': area, 'selected-layer': area }],
    ]);
  });
});

describe('editStatesOf', () => {
  it('names selected as removed by the new of variant-cell@edit', () => {
    expect(editStatesOf(variantCellTargets(), PART)).toEqual({ removed: ['selected'], added: [], redrawn: [] });
  });

  it('names a state both draw differently as redrawn', () => {
    const targets = variantCellTargets();
    const old = targets[1];

    if (old) old.unchanged = SHARED.filter((state) => state !== 'pinned');

    expect(editStatesOf(targets, PART).redrawn).toEqual(['pinned']);
  });
});

describe('editNoteOf', () => {
  it('counts the differing states, never naming them or a commit', () => {
    expect(
      editNoteOf({
        note: 'Direkt geändert',
        states: { removed: ['selected'], added: ['merging', 'page-sketch'], redrawn: ['drawing'] },
      }),
    ).toBe('Direkt geändert · 1 Zustand entfällt · 2 Zustände neu · 1 Zustand anders');
  });

  it('counts a heavy edit of many states without listing one', () => {
    const redrawn = Array.from({ length: 38 }, (_, index) => `page-${index}`);

    expect(editNoteOf({ note: 'Direkt geändert', states: { removed: [], added: [], redrawn } })).toBe(
      'Direkt geändert · 38 Zustände anders',
    );
  });

  it('is the bare note when no state differs', () => {
    expect(editNoteOf({ note: 'Direkt geändert', states: { removed: [], added: [], redrawn: [] } })).toBe(
      'Direkt geändert',
    );
  });
});
