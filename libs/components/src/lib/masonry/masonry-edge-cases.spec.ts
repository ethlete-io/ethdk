import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { query, queryAll } from '../testing/driver-core';
import { MasonryDirective } from './headless';
import { packMasonryItems, resolveMasonryColumns } from './headless/internals/masonry-layout';
import { MASONRY_IMPORTS } from './masonry.imports';
import { createMasonryHarness, MasonryHarness } from './testing/masonry-driver';

let masonry: MasonryHarness;

@Component({
  selector: 'et-test-masonry-edge-host',
  template: `
    @if (shown()) {
      <ul [columnWidth]="columnWidth()" [gap]="gap()" etMasonry>
        @for (item of items(); track item.id) {
          <li [attr.data-test-height]="item.height" etMasonryItem>{{ item.id }}</li>
        }
      </ul>
    }
  `,
  imports: [MASONRY_IMPORTS],
})
class MasonryEdgeHostComponent {
  public masonry = viewChild(MasonryDirective);

  public shown = signal(true);
  public columnWidth = signal<number | string>(250);
  public gap = signal<number | string>(16);
  public items = signal<{ id: string; height: number }[]>([]);
}

const createHost = (items: { id: string; height: number }[] = []) => {
  const fixture = TestBed.createComponent(MasonryEdgeHostComponent);

  fixture.componentInstance.items.set(items);
  fixture.detectChanges();
  masonry.settle(fixture);

  return fixture;
};

const container = (fixture: ComponentFixture<MasonryEdgeHostComponent>) => query(fixture, '.et-masonry')!;
const items = (fixture: ComponentFixture<MasonryEdgeHostComponent>) => queryAll(fixture, '.et-masonry-item');

describe('resolveMasonryColumns edge values', () => {
  it('lays out one column for a NaN column width instead of NaN columns', () => {
    expect(resolveMasonryColumns({ containerInlineSize: 600, minColumnInlineSize: NaN, gap: 16 })).toEqual({
      count: 1,
      inlineSize: 600,
    });
  });

  it('treats a NaN gap as no gap', () => {
    expect(resolveMasonryColumns({ containerInlineSize: 500, minColumnInlineSize: 250, gap: NaN })).toEqual({
      count: 2,
      inlineSize: 250,
    });
  });

  it('reports no columns for a NaN container width', () => {
    expect(resolveMasonryColumns({ containerInlineSize: NaN, minColumnInlineSize: 250, gap: 16 })).toEqual({
      count: 0,
      inlineSize: 0,
    });
  });

  it('keeps every offset finite for a NaN gap', () => {
    const packing = packMasonryItems({
      itemBlockSizes: [100, 50, 70],
      columnCount: 2,
      columnInlineSize: 200,
      gap: NaN,
    });

    expect(packing.placements.flatMap((p) => [p.inlineOffset, p.blockOffset]).every(Number.isFinite)).toBe(true);
    expect(packing.blockSize).toBe(120);
  });
});

describe('MasonryDirective edge cases', () => {
  beforeEach(() => {
    masonry = createMasonryHarness({ containerWidth: 1000 });
  });

  it('settles empty, with no height', () => {
    const fixture = createHost();

    expect(fixture.componentInstance.masonry()!.isSettled()).toBe(true);
    expect(container(fixture).style.height).toBe('0px');
  });

  it('places a single item at the start and takes its height', () => {
    const fixture = createHost([{ id: 'a', height: 120 }]);
    const [item] = items(fixture);

    expect(item!.getAttribute('data-column')).toBe('0');
    expect(item!.style.getPropertyValue('--_et-masonry-item-block-offset')).toBe('0px');
    expect(container(fixture).style.height).toBe('120px');
  });

  it('drops back to no height once every item is removed', () => {
    const fixture = createHost([
      { id: 'a', height: 120 },
      { id: 'b', height: 80 },
    ]);

    fixture.componentInstance.items.set([]);
    fixture.detectChanges();
    masonry.settle(fixture);

    expect(fixture.componentInstance.masonry()!.items()).toEqual([]);
    expect(container(fixture).style.height).toBe('0px');
  });

  it('keeps item widths and offsets finite for a non-numeric column width and gap', () => {
    const fixture = createHost([
      { id: 'a', height: 120 },
      { id: 'b', height: 80 },
    ]);

    fixture.componentInstance.columnWidth.set('wide');
    fixture.componentInstance.gap.set('large');
    fixture.detectChanges();
    masonry.settle(fixture);

    const { count, inlineSize } = fixture.componentInstance.masonry()!.columns();

    expect(Number.isFinite(count) && Number.isFinite(inlineSize)).toBe(true);
    expect(items(fixture).every((item) => !item.style.width.includes('NaN'))).toBe(true);
    expect(container(fixture).style.height).not.toBe('');
  });

  it('can be destroyed mid-resize without erroring', () => {
    const fixture = createHost([{ id: 'a', height: 120 }]);

    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();

    expect(container(fixture)).toBeNull();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
