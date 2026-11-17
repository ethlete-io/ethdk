import { PartTree } from '../design-parts/part-tree/part-tree.component';
import { cropGroupsOf } from '../design-parts/sketches/sketch-crops';
import { SketchRow } from '../design-parts/sketches/sketches-sample';
import { LISTING_ERROR_SAMPLE } from '../design-parts/system-page/system-page-sample';
import { DESIGN_HARNESS_SAMPLES } from './design-harness-samples';

const sketchesOf = (props: Record<string, unknown>) => {
  const sample = DESIGN_HARNESS_SAMPLES['pages/sketches'];

  if (!sample) throw new Error('no pages/sketches sample');

  return sample(props);
};

describe('DESIGN_HARNESS_SAMPLES', () => {
  it('feeds the diff-mark state the hold-trigger grid whose cells but closed rest carry a state difference', () => {
    const sample = DESIGN_HARNESS_SAMPLES['elements/canvas-frames'];

    if (!sample) throw new Error('no elements/canvas-frames sample');

    const props = sample({ part: 'button', zoom: '100%', diff: true });
    const [frame] = props['frames'] as { grid: { cells: { label: string; diff?: string }[] } }[];
    const diffs = Object.fromEntries(
      (frame?.grid.cells ?? []).map((cell) => [
        cell.label,
        cell.diff ? JSON.parse(decodeURIComponent(cell.diff.replace('data:application/json,', ''))).box : null,
      ]),
    );

    expect(props).not.toHaveProperty('diff');
    expect(Object.keys(diffs)).toHaveLength(8);
    expect(diffs['closed · rest']).toBeNull();
    expect(diffs['closed · hover']).toMatchObject({ y: 8 });
    expect(diffs['open · rest']).toMatchObject({ y: 48 });
  });

  it('feeds the change-crop states a screen sketch whose variant carries the crop data', () => {
    const props = sketchesOf({ camera: 'fit', part: 'narrow', screen: 'crop' });
    const groups = cropGroupsOf(props['rows'] as SketchRow[]);

    expect(props['part']).toBe('pages/sketches');
    expect(props['screen']).toBeUndefined();
    expect(props['wholeScreens']).toEqual([]);
    expect(groups.map((group) => group.states.length)).toEqual([12, 1]);
    expect(groups[0]?.crop).toEqual({ x: 818, y: 347, width: 622, height: 93 });
  });

  it('draws the first crop group whole in change-crop-whole', () => {
    const props = sketchesOf({ camera: 'fit', part: 'narrow', screen: 'whole' });

    expect(props['wholeScreens']).toEqual(['comparing-narrow']);
  });

  it('feeds the agent and port props as their samples and refuses a value without one', () => {
    expect(sketchesOf({ part: 'narrow', agent: 'failed' })['agent']).toMatchObject({ failed: true });
    expect(sketchesOf({ part: 'narrow', port: 'two' })['port']).toMatchObject({ merged: expect.any(Array) });
    expect(sketchesOf({ part: 'narrow' })).not.toHaveProperty('agent');
    expect(() => sketchesOf({ part: 'narrow', agent: 'nope' })).toThrow('agent=nope');
    expect(() => sketchesOf({ part: 'narrow', port: 'nope' })).toThrow('port=nope');
  });

  it('keeps the narrow chip sample when no screen is set', () => {
    expect(sketchesOf({ part: 'narrow' })['part']).toBe('components/zoom-chip');
  });

  it('feeds the edit part an @edit chip sample with the rows old and new', () => {
    const props = sketchesOf({ camera: 'fit', part: 'edit' });

    expect(props['part']).toBe('components/zoom-chip@edit');
    expect((props['rows'] as SketchRow[]).map((row) => row.key)).toEqual(['old', 'new']);
  });

  it('refuses a part prop it has no sample for instead of drawing the title-bar rows', () => {
    expect(() => sketchesOf({ camera: 'fit', part: 'unknown' })).toThrow(
      'no sample for prop part=unknown of part pages/sketches',
    );
  });

  it('selects the @edit row in the tree of the edit part', () => {
    const tree = sketchesOf({ part: 'edit' })['tree'] as PartTree;

    expect(tree.layers[0]?.parts.map(({ name, selected }) => (selected ? `${name}*` : name))).toEqual([
      'title-bar',
      'zoom-chip@edit*',
      'zoom-chip',
    ]);
  });

  it('turns the listing-error flag into the server reason', () => {
    const sample = DESIGN_HARNESS_SAMPLES['pages/system'];

    expect(sample?.({ listingError: true })['listingError']).toBe(LISTING_ERROR_SAMPLE);
    expect(sample?.({})['listingError']).toBeNull();
  });
});
