import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { query, queryAll } from '../testing/driver-core';
import { MasonryDirective } from './headless';
import { MASONRY_IMPORTS } from './masonry.imports';
import { createMasonryHarness, MasonryHarness } from './testing/masonry-driver';

/**
 * jsdom has no layout, so the geometry every part of this depends on has to be faked. The fake is deliberately
 * thin: a fixed container width, and item heights declared per item in the template. Item *widths* come from
 * the inline width the masonry itself assigns, which is what lets the real `isMeasured` handshake run.
 */
const CONTAINER_WIDTH = 1000;

let masonry: MasonryHarness;

@Component({
  selector: 'et-test-masonry-host',
  template: `
    <ul [columnWidth]="columnWidth()" [gap]="gap()" etMasonry>
      @for (item of items(); track item.id) {
        <li [attr.data-test-height]="item.height" etMasonryItem>{{ item.id }}</li>
      }
    </ul>
  `,
  imports: [MASONRY_IMPORTS],
})
class MasonryHostComponent {
  public masonry = viewChild.required(MasonryDirective);

  public columnWidth = signal(250);
  public gap = signal(16);
  public items = signal([
    { id: 'a', height: 300 },
    { id: 'b', height: 100 },
    { id: 'c', height: 200 },
  ]);

  public setHeight(id: string, height: number) {
    this.items.update((current) => current.map((item) => (item.id === id ? { ...item, height } : item)));
  }
}

/** Renders, then settles: the container's size, then the items' sizes at the width they were given. */
const createHost = (): ComponentFixture<MasonryHostComponent> => {
  const fixture = TestBed.createComponent(MasonryHostComponent);

  fixture.detectChanges();
  settle(fixture);

  return fixture;
};

const settle = (fixture: ComponentFixture<MasonryHostComponent>) => masonry.settle(fixture);

const container = (fixture: ComponentFixture<MasonryHostComponent>) => query(fixture, '.et-masonry')!;

const items = (fixture: ComponentFixture<MasonryHostComponent>) => queryAll(fixture, '.et-masonry-item');

/** What `items()` holds, in its order - a `@for` re-order moves nodes without touching a registration. */
const masonryItemTexts = (fixture: ComponentFixture<MasonryHostComponent>) =>
  fixture.componentInstance
    .masonry()
    .items()
    .map((item) => item.elementRef.nativeElement.textContent?.trim());

/** A `MutationObserver` delivers on a microtask, and the DOM order is only observable through one. */
const flushMutations = () => Promise.resolve();

const offsets = (fixture: ComponentFixture<MasonryHostComponent>) =>
  items(fixture).map((item) => ({
    inline: item.style.getPropertyValue('--_et-masonry-item-inline-offset'),
    block: item.style.getPropertyValue('--_et-masonry-item-block-offset'),
  }));

describe('MasonryDirective', () => {
  beforeEach(() => {
    masonry = createMasonryHarness({ containerWidth: CONTAINER_WIDTH });
  });

  it('exposes list semantics on the container and its items', () => {
    const fixture = createHost();

    expect(container(fixture).getAttribute('role')).toBe('list');
    expect(items(fixture).every((item) => item.getAttribute('role') === 'listitem')).toBe(true);
  });

  it('gives every item the resolved column width', () => {
    const fixture = createHost();
    // 1000px at a 250px minimum and a 16px gap is three columns of 322.67px.
    const expected = (CONTAINER_WIDTH - 2 * 16) / 3;

    expect(fixture.componentInstance.masonry().columns()).toEqual({ count: 3, inlineSize: expected });
    expect(items(fixture).map((item) => item.style.width)).toEqual(Array.from({ length: 3 }, () => `${expected}px`));
  });

  it('places the first row across the columns and sizes the container to the tallest', () => {
    const fixture = createHost();
    const columnWidth = (CONTAINER_WIDTH - 2 * 16) / 3;

    expect(offsets(fixture)).toEqual([
      { inline: '0px', block: '0px' },
      { inline: `${columnWidth + 16}px`, block: '0px' },
      { inline: `${2 * (columnWidth + 16)}px`, block: '0px' },
    ]);
    expect(container(fixture).style.height).toBe('300px');
  });

  it('marks placed items and reports itself settled', () => {
    const fixture = createHost();

    expect(items(fixture).every((item) => item.hasAttribute('data-positioned'))).toBe(true);
    expect(fixture.componentInstance.masonry().isSettled()).toBe(true);
    expect(container(fixture).hasAttribute('data-settled')).toBe(true);
  });

  it('settles from the post-render measurement without waiting for a resize observer delivery', () => {
    const fixture = TestBed.createComponent(MasonryHostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.masonry().isSettled()).toBe(true);
    expect(items(fixture).every((item) => item.hasAttribute('data-positioned'))).toBe(true);
  });

  it('sends an appended item to the shortest column and leaves the others where they are', () => {
    const fixture = createHost();
    const columnWidth = (CONTAINER_WIDTH - 2 * 16) / 3;
    const before = offsets(fixture);

    fixture.componentInstance.items.update((current) => [...current, { id: 'd', height: 50 }]);
    fixture.detectChanges();
    settle(fixture);

    const after = offsets(fixture);

    expect(after.slice(0, 3)).toEqual(before);
    // Column 1 holds the 100px item, so it is the shortest - the new item stacks below it. Compared against
    // the absolute offset, not `before[1]`, so a bug that shifted every column together cannot slip past this.
    expect(after[3]).toEqual({ inline: `${columnWidth + 16}px`, block: '116px' });
  });

  it('re-packs in DOM order when the items are re-ordered', () => {
    const fixture = createHost();

    fixture.componentInstance.items.update((current) => [...current].reverse());
    fixture.detectChanges();
    settle(fixture);

    expect(items(fixture).map((item) => item.textContent?.trim())).toEqual(['c', 'b', 'a']);
    // Heights 200 / 100 / 300 across three columns: still one per column, and the container follows the tallest.
    expect(offsets(fixture).map((offset) => offset.block)).toEqual(['0px', '0px', '0px']);
    expect(container(fixture).style.height).toBe('300px');
  });

  it('re-sorts a feed that only moved its DOM nodes, and rebalances the columns for the new order', async () => {
    const fixture = createHost();
    const columnWidth = (CONTAINER_WIDTH - 2 * 16) / 3;

    // A fourth item shares a column, so the pack before the re-sort is not one item per column.
    fixture.componentInstance.items.update((current) => [...current, { id: 'd', height: 50 }]);
    fixture.detectChanges();
    settle(fixture);

    fixture.componentInstance.items.update((current) => [...current].reverse());
    fixture.detectChanges();
    await flushMutations();
    settle(fixture);

    expect(masonryItemTexts(fixture)).toEqual(['d', 'c', 'b', 'a']);
    // d, c and b take a column each in reading order; a is the tallest and goes under the 50px d.
    expect(offsets(fixture)).toEqual([
      { inline: '0px', block: '0px' },
      { inline: `${columnWidth + 16}px`, block: '0px' },
      { inline: `${2 * (columnWidth + 16)}px`, block: '0px' },
      { inline: '0px', block: '66px' },
    ]);
    expect(container(fixture).style.height).toBe('366px');
  });

  it('re-columns when the column width changes', () => {
    const fixture = createHost();

    // 480px is the widest a second column can be here: two of them plus the gap need 976px of the 1000.
    fixture.componentInstance.columnWidth.set(480);
    fixture.detectChanges();
    settle(fixture);

    // Two columns of 492px: the third item stacks under the shorter of them.
    expect(fixture.componentInstance.masonry().columns().count).toBe(2);
    expect(offsets(fixture).map((offset) => offset.block)).toEqual(['0px', '0px', '116px']);
    expect(container(fixture).style.height).toBe('316px');
  });

  it('keeps items visible while a column width change is being re-measured', () => {
    const fixture = createHost();

    // 480 changes the count from three columns to two, so the width every item was measured at is now stale.
    fixture.componentInstance.columnWidth.set(480);
    fixture.detectChanges();

    // The items' recorded widths are the old ones until their observers report, so nothing is "measured" -
    // but the reveal latches, because un-revealing here is what fades a whole masonry out mid window-drag.
    expect(fixture.componentInstance.masonry().isSettled()).toBe(false);
    expect(items(fixture).every((item) => item.hasAttribute('data-positioned'))).toBe(true);
  });

  describe('column stability', () => {
    /** A fourth item, so there is one that shares a column and can therefore be displaced. */
    const createFourUp = () => {
      const fixture = createHost();

      fixture.componentInstance.items.update((current) => [...current, { id: 'd', height: 50 }]);
      fixture.detectChanges();
      settle(fixture);

      return fixture;
    };

    const columnsOf = (fixture: ComponentFixture<MasonryHostComponent>) =>
      items(fixture).map((item) => item.getAttribute('data-column'));

    it('places the fourth item in the shortest column', () => {
      expect(columnsOf(createFourUp())).toEqual(['0', '1', '2', '1']);
    });

    it('does not move other items to another column when one item grows', () => {
      const fixture = createFourUp();

      // Greedy packing from scratch would now prefer column 2 for the last item, because the column it shares
      // with the grown one is no longer the shortest. Growing a card must not rearrange the grid around it.
      fixture.componentInstance.setHeight('b', 900);
      fixture.detectChanges();
      settle(fixture);

      expect(columnsOf(fixture)).toEqual(['0', '1', '2', '1']);
      // It still has to move *down*, since the item above it in its column got taller.
      expect(offsets(fixture)[3]?.block).toBe('916px');
    });

    it('rebalances on repack()', () => {
      const fixture = createFourUp();

      fixture.componentInstance.setHeight('b', 900);
      fixture.detectChanges();
      settle(fixture);

      fixture.componentInstance.masonry().repack();
      fixture.detectChanges();
      settle(fixture);

      expect(columnsOf(fixture)).toEqual(['0', '1', '2', '2']);
    });

    it('rebalances when the column count changes', () => {
      const fixture = createFourUp();

      fixture.componentInstance.setHeight('b', 900);
      fixture.detectChanges();
      settle(fixture);

      // Two columns: assignments made for three say nothing about this layout, so it packs from scratch.
      fixture.componentInstance.columnWidth.set(480);
      fixture.detectChanges();
      settle(fixture);

      expect(columnsOf(fixture)).toEqual(['0', '1', '0', '0']);
    });
  });

  describe('an item whose reported box can never match the width it is given', () => {
    beforeEach(() => {
      masonry = createMasonryHarness({ containerWidth: CONTAINER_WIDTH, borderBoxOverflow: 20 });
    });

    it('still settles, places and reveals every item', () => {
      const fixture = createHost();

      expect(fixture.componentInstance.masonry().isSettled()).toBe(true);
      expect(items(fixture).every((item) => item.hasAttribute('data-positioned'))).toBe(true);
      expect(offsets(fixture).map((offset) => offset.block)).toEqual(['0px', '0px', '0px']);
      expect(container(fixture).style.height).toBe('300px');
    });

    it('waits for a report at the new width before it counts as settled again', () => {
      const fixture = createHost();

      fixture.componentInstance.columnWidth.set(480);
      fixture.detectChanges();

      expect(fixture.componentInstance.masonry().isSettled()).toBe(false);

      settle(fixture);

      expect(fixture.componentInstance.masonry().isSettled()).toBe(true);
    });
  });

  it('drops an unregistered item out of the packing', () => {
    const fixture = createHost();

    fixture.componentInstance.items.update((current) => current.filter((item) => item.id !== 'a'));
    fixture.detectChanges();
    settle(fixture);

    expect(items(fixture)).toHaveLength(2);
    expect(container(fixture).style.height).toBe('200px');
  });
});
