import { reflectComponentType } from '@angular/core';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { PartTree } from '../design-parts/part-tree/part-tree.component';
import { cropGroupsOf } from '../design-parts/sketches/sketch-crops';
import { SketchesComponent } from '../design-parts/sketches/sketches.component';
import { SketchRow } from '../design-parts/sketches/sketches-sample';
import { LISTING_ERROR_SAMPLE } from '../design-parts/system-page/system-page-sample';
import { DESIGN_HARNESS_SAMPLES } from './design-harness-samples';
import { FARN_SURFACE } from '../../farn-surface-themes';
import { FARN_THEME } from '../../farn-themes';
import { DARK_SURFACE } from '../../surface-themes';
import { BRAND_THEME } from '../../themes';
import { FARN_SCOPE, sampleBar, sampleNarrowPage, samplePage, sampleStepper, samplePotTile } from './sample-product';

const sketchesOf = (props: Record<string, unknown>) => {
  const sample = DESIGN_HARNESS_SAMPLES['pages/sketches'];

  if (!sample) throw new Error('no pages/sketches sample');

  return sample(props);
};

describe('DESIGN_HARNESS_SAMPLES', () => {
  it('feeds the diff-mark state the quantity-stepper grid whose interaction cells carry a difference against their row rest', () => {
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
    expect(diffs['count · rest']).toBeNull();
    expect(diffs['count · hover']).toMatchObject({ y: 8 });
    expect(diffs['add · rest']).toBeNull();
    expect(diffs['add · hover']).toEqual({ x: 96, y: 8, width: 88, height: 30 });
  });

  it('binds only design-canvas inputs in the zoom-chip hover states of elements/canvas-frames', () => {
    const sample = DESIGN_HARNESS_SAMPLES['elements/canvas-frames'];

    if (!sample) throw new Error('no elements/canvas-frames sample');

    const inputs = new Set(reflectComponentType(DesignCanvasComponent)?.inputs.map(({ templateName }) => templateName));
    const props = sample({
      part: 'button',
      states: ['filled', 'outline', 'tonal'],
      zoom: '25%',
      target: 'out',
      interaction: 'hover',
    });

    expect(Object.keys(props).filter((key) => key !== 'class' && !inputs.has(key))).toEqual([]);
  });

  it('feeds elements/shell-main the rail products its design draws', () => {
    const sample = DESIGN_HARNESS_SAMPLES['elements/shell-main'];

    if (!sample) throw new Error('no elements/shell-main sample');

    expect(sample({})['products']).toEqual(['studio', 'studio-lab', 'sdk', 'timetrack', 'docs']);
  });

  it('feeds the change-crop states a screen sketch whose variant carries the crop data', () => {
    const props = sketchesOf({ camera: 'fit', part: 'narrow', screen: 'crop' });
    const groups = cropGroupsOf(props['rows'] as SketchRow[]);

    expect(props['part']).toBe('pages/plants');
    expect(props['screen']).toBeUndefined();
    expect(props['wholeScreens']).toEqual([]);
    expect(groups.map((group) => group.states.length)).toEqual([10, 1]);
    expect(groups[0]?.crop).toEqual({ x: 818, y: 347, width: 622, height: 93 });
  });

  it('draws the first crop group whole in change-crop-whole', () => {
    const props = sketchesOf({ camera: 'fit', part: 'narrow', screen: 'whole' });

    expect(props['wholeScreens']).toEqual(['comparing-narrow']);
  });

  it('feeds the agent and port props as their samples and refuses a value without one', () => {
    expect(sketchesOf({ part: 'narrow', agent: 'failed' })['agent']).toMatchObject({ failure: expect.any(String) });
    expect(sketchesOf({ part: 'narrow', port: 'two' })['port']).toMatchObject({ merged: expect.any(Array) });
    expect(sketchesOf({ part: 'narrow' })).not.toHaveProperty('agent');
    expect(() => sketchesOf({ part: 'narrow', agent: 'nope' })).toThrow('agent=nope');
    expect(() => sketchesOf({ part: 'narrow', port: 'nope' })).toThrow('port=nope');
  });

  it('keeps the narrow stepper sample when no screen is set', () => {
    expect(sketchesOf({ part: 'narrow' })['part']).toBe('components/quantity-stepper');
  });

  it('feeds the edit part an @edit stepper sample with the rows old and new', () => {
    const props = sketchesOf({ camera: 'fit', part: 'edit' });

    expect(props['part']).toBe('components/quantity-stepper@edit');
    expect((props['rows'] as SketchRow[]).map((row) => row.key)).toEqual(['old', 'new']);
  });

  it('refuses a part prop it has no sample for instead of drawing the shop-bar rows', () => {
    expect(() => sketchesOf({ camera: 'fit', part: 'unknown' })).toThrow(
      'no sample for prop part=unknown of part pages/sketches',
    );
  });

  it('selects the @edit row in the tree of the edit part', () => {
    const tree = sketchesOf({ part: 'edit' })['tree'] as PartTree;

    expect(tree.layers[0]?.parts.map(({ name, selected }) => (selected ? `${name}*` : name))).toEqual([
      'plant-page',
      'shop-bar',
      'quantity-stepper@edit*',
      'quantity-stepper',
    ]);
  });

  it('draws the many part with 30 states in every row and selects it in the tree', () => {
    const props = sketchesOf({ camera: 'fit', part: 'many' });
    const tree = props['tree'] as PartTree;

    expect(props['part']).toBe('components/plant-page');
    expect((props['rows'] as SketchRow[]).map((row) => row.shots.length)).toEqual([30, 30, 30]);
    expect(tree.layers[0]?.parts.find(({ selected }) => selected)?.name).toBe('plant-page');
  });

  it.each(['three', 'many'])('feeds the multi-part sample %s only inputs the sketches page declares', (multi) => {
    const inputs = new Set(reflectComponentType(SketchesComponent)?.inputs.map(({ templateName }) => templateName));
    const props = sketchesOf({ camera: 'fit', part: 'narrow', multi });

    expect(Object.keys(props).filter((key) => !inputs.has(key))).toEqual([]);
  });

  it('turns the listing-error flag into the server reason', () => {
    const sample = DESIGN_HARNESS_SAMPLES['pages/system'];

    expect(sample?.({ listingError: true })['listingError']).toBe(LISTING_ERROR_SAMPLE);
    expect(sample?.({})['listingError']).toBeNull();
  });

  it('tints the hovered stepper field as a translucent wash, not the full light interaction colour', () => {
    const count = /<span[^>]*data-farn-count/.exec(sampleStepper('count-hover'))?.[0] ?? '';

    expect(count).toMatch(/bg-et-surface-interaction\/\d+/);
    expect(count).not.toMatch(/bg-et-surface-interaction(?![/\w-])/);
  });

  it('draws each Farn plant with its own shape', () => {
    const page = samplePage('1', true);
    const drawingOf = (plant: string) =>
      new RegExp(`data-farn-plant="${plant}"[^>]*>([\\s\\S]*?</svg\\s*>)`).exec(page)?.[1];
    const drawings = ['Monstera', 'Calathea', 'Geigenfeige', 'Zamioculcas', 'Pilea'].map(drawingOf);

    expect(drawings.every(Boolean)).toBe(true);
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  it('pushes the account and the basket to the right of the narrow Farn bar, where the search is hidden', () => {
    const host = document.createElement('div');
    host.innerHTML = sampleBar('member', true);
    const bar = host.querySelector('[data-farn-bar]');
    const search = bar?.querySelector('[data-farn-search]');
    const account = search?.nextElementSibling;

    expect(search?.classList.contains('hidden')).toBe(true);
    expect(account?.textContent).toContain('Lena');
    expect(account?.classList.contains('ml-auto')).toBe(true);
    expect(account?.classList.contains('md:ml-0')).toBe(true);
  });

  it('draws the search field as a translucent field with an icon and a placeholder', () => {
    const search = /<span[^>]*data-farn-search[\s\S]*?<\/span/.exec(sampleBar('member'))?.[0] ?? '';

    expect(search).toContain('<svg');
    expect(search).toContain('Pflanzen suchen');
    expect(search).not.toMatch(/bg-et-surface-interaction(?![/\w-])/);
  });

  it("puts every Farn root under the Farn surface and colour scope, not Studio's", () => {
    const roots = [sampleBar('guest'), sampleStepper('count'), samplePage('1'), samplePotTile('12', '18 €')];

    for (const root of roots) {
      const classes = /class="([^"]*)"/.exec(root)?.[1] ?? '';

      expect(classes).toContain(FARN_SCOPE);
      expect(classes).not.toContain('et-surface--dark');
      expect(classes).not.toContain('et-color--brand');
    }

    expect(FARN_SCOPE).toBe(`et-surface--${FARN_SURFACE.name} et-color--${FARN_THEME.name}`);
  });

  it('gives Farn its own surface and accent palette that shares no colour with Studio', () => {
    const { background, color, border } = FARN_SURFACE;

    expect(FARN_SURFACE.name).not.toBe(DARK_SURFACE.name);
    expect(FARN_THEME.name).not.toBe(BRAND_THEME.name);
    expect(background).not.toBe(DARK_SURFACE.background);
    expect(color).not.toBe(DARK_SURFACE.color);
    expect(border).not.toBe(DARK_SURFACE.border);
    expect(FARN_THEME.primary.color.default).not.toBe(BRAND_THEME.primary.color.default);
    expect(FARN_THEME.primary.inkColor?.default).not.toBe(BRAND_THEME.primary.inkColor?.default);
  });

  it('draws the narrow page without any md: utility, account and basket right of the logo', () => {
    const html = sampleNarrowPage('phone-01');

    expect(html).not.toMatch(/\smd:/);
    expect(html).toContain('data-farn-page="phone-01"');
    expect(html).toMatch(/data-farn-search/);
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*"\s+data-farn-nav/);
  });
});
