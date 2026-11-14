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
