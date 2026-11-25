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

  it('leaves the targets of any other sketch as they are', () => {
    const targets = variantCellTargets();
    const sketch = { ...editSketch, target: `${PART}@other` } as Sketch;

    expect(withEditUnchanged(sketch, targets)).toBe(targets);
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
  it('names the differing states in the words of the cells, without a commit', () => {
    expect(
      editNoteOf({
        note: 'Direkt geändert',
        states: { removed: ['selected'], added: ['merging'], redrawn: ['drawing'] },
      }),
    ).toBe('Direkt geändert · Entfällt: selected · Neu: merging · Anders: drawing');
  });

  it('is the bare note when no state differs', () => {
    expect(editNoteOf({ note: 'Direkt geändert', states: { removed: [], added: [], redrawn: [] } })).toBe(
      'Direkt geändert',
    );
  });
});
