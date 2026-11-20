import { describe, expect, it } from 'vitest';
import { keptStatesOf, sketchFrameSetOf, SketchFrameRow } from './sketch-frame-set';
import { Axis, ComparedRow, planOf, shownStatesOf } from './shot-command';

const BASE = ['rest', 'hover', 'stale-one', 'stale-many', 'closed'];

const axisOf = (variant: string | null): Axis => ({
  label: variant ?? 'merged',
  sketch: variant ? { target: 'pages/system', variant } : null,
});

const shotSetOf = (listed: ComparedRow[], hidden: ComparedRow[] = []): [string, string][] => {
  const shown = shownStatesOf({ listed, hidden });
  const plan = planOf({
    base: { product: 'studio', part: 'pages/system', width: null, interaction: null, preset: null },
    rows: listed.map(({ axis }) => axis),
    statesOf: (axis) => [...(shown.get(axis) ?? [])],
    states: true,
    state: null,
  });

  return plan.flatMap((row, index) =>
    row.map((cell): [string, string] => [listed[index]?.axis.sketch?.variant ?? 'current', cell.address.state]),
  );
};

const studioSetOf = (listed: ComparedRow[], hidden: ComparedRow[] = []) => {
  const rowOf = ({ axis, names, unchanged }: ComparedRow): SketchFrameRow => ({
    key: axis.sketch?.variant ?? 'current',
    shots: names.map((state) => ({ state, changed: axis.sketch ? !unchanged.includes(state) : false })),
  });

  return sketchFrameSetOf({ listed: listed.map(rowOf), hidden: hidden.map(rowOf) });
};

describe('the frame set of a sketch round', () => {
  const merged = { axis: axisOf(null), names: BASE, unchanged: BASE };
  const a = { axis: axisOf('a'), names: BASE, unchanged: ['rest', 'hover', 'closed'] };
  const b = { axis: axisOf('b'), names: BASE, unchanged: ['rest', 'closed'] };

  it('is the same list in the shot and the Studio view', () => {
    expect(shotSetOf([merged, a, b])).toEqual(studioSetOf([merged, a, b]));
  });

  it('folds the states no variant changes and keeps the ones some variant changes', () => {
    const states = new Set(shotSetOf([merged, a, b]).map(([, state]) => state));

    expect([...states]).toEqual(['hover', 'stale-one', 'stale-many']);
  });

  it('counts a withdrawn variant toward the fold in both', () => {
    const withdrawn = { axis: axisOf('w'), names: BASE, unchanged: ['rest', 'hover', 'stale-one', 'stale-many'] };

    expect(shotSetOf([merged, a], [withdrawn])).toEqual(studioSetOf([merged, a], [withdrawn]));
    expect(shotSetOf([merged, a], [withdrawn]).map(([, state]) => state)).toContain('closed');
  });

  it('draws every state when the round changes none', () => {
    const same = { axis: axisOf('same'), names: BASE, unchanged: BASE };

    expect(shotSetOf([merged, same])).toEqual(studioSetOf([merged, same]));
    expect(shotSetOf([merged, same])).toHaveLength(BASE.length * 2);
  });
});

describe('the interaction neighbourhood of a changed state', () => {
  const NAMES = ['save', 'save-hover', 'save-active', 'save-focus-visible', 'remove', 'remove-hover'];
  const rowsOf = (changed: string[]): SketchFrameRow[] => [
    { key: 'current', shots: NAMES.map((state) => ({ state, changed: false })) },
    { key: 'a', shots: NAMES.map((state) => ({ state, changed: changed.includes(state) ? true : false })) },
  ];
  const statesShown = (rows: SketchFrameRow[]) => [
    ...new Set(sketchFrameSetOf({ listed: rows }).map(([, state]) => state)),
  ];

  it('keeps the whole row of a changed interaction and folds the other rows', () => {
    expect(statesShown(rowsOf(['save-hover']))).toEqual(['save', 'save-hover', 'save-active', 'save-focus-visible']);
  });

  it('keeps the row of a changed rest state', () => {
    expect(statesShown(rowsOf(['remove']))).toEqual(['remove', 'remove-hover']);
  });

  it('draws every state when each row has a change', () => {
    expect(statesShown(rowsOf(['save-hover', 'remove-hover']))).toEqual(NAMES);
  });
});

describe('keptStatesOf', () => {
  it('keeps the states every variant lists as unchanged', () => {
    expect(keptStatesOf(['rest', 'hover'], [['rest', 'hover'], ['rest']])).toEqual(['rest']);
  });

  it('keeps nothing without a variant', () => {
    expect(keptStatesOf(['rest'], [])).toEqual([]);
  });
});
