import { Component, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MASONRY_ERROR_CODES, MASONRY_IMPORTS, MASONRY_TOKEN, MasonryDirective, MasonryItemDirective } from '../index';
import { createMasonryHarness } from '../lib/masonry/testing/masonry-driver';
import '../test-helpers';
import { useScenario } from './harness';

type Photo = { id: string; height: number };

const PAGE_ONE: Photo[] = [
  { id: 'a', height: 300 },
  { id: 'b', height: 100 },
  { id: 'c', height: 200 },
  { id: 'd', height: 80 },
];

@Component({
  selector: 'et-scenario-photo-column',
  template: `<span class="column-count">{{ columnCount() }}</span>`,
})
class PhotoColumnCountComponent {
  private masonry = inject(MASONRY_TOKEN);

  columnCount = computed(() => this.masonry.columns().count);
}

@Component({
  selector: 'et-scenario-photo-feed',
  imports: [MASONRY_IMPORTS, PhotoColumnCountComponent],
  template: `
    <ul #feed="etMasonry" [columnWidth]="columnWidth()" [gap]="16" etMasonry>
      @for (photo of photos(); track photo.id) {
        <li [attr.data-test-height]="photo.height" etMasonryItem>
          {{ photo.id }}
          @if ($first) {
            <et-scenario-photo-column />
          }
        </li>
      }
    </ul>
    <button [disabled]="!feed.isSettled()" (click)="loadMore()" class="more" type="button">Load more</button>
    <button (click)="feed.repack()" class="repack" type="button">Rebalance</button>
  `,
})
class PhotoFeedComponent {
  photos = signal(PAGE_ONE);
  columnWidth = signal(250);

  loadMore() {
    this.photos.update((photos) => [...photos, { id: 'e', height: 50 }]);
  }

  setHeight(id: string, height: number) {
    this.photos.update((photos) => photos.map((photo) => (photo.id === id ? { ...photo, height } : photo)));
  }
}

@Component({
  selector: 'et-scenario-broken-masonry',
  imports: [MASONRY_IMPORTS],
  template: `<li class="stray" etMasonryItem>Stray</li>`,
})
class StrayMasonryItemComponent {}

@Component({
  selector: 'et-scenario-itemless-masonry',
  imports: [MASONRY_IMPORTS],
  template: `<ul etMasonry>
    <li>Not an item</li>
  </ul>`,
})
class ItemlessMasonryComponent {}

const code = (value: number) => `ET${value}`;

const layout = (host: Element) =>
  Array.from(host.querySelectorAll<HTMLElement>('.et-masonry-item')).map((item) => ({
    id: item.firstChild?.textContent?.trim(),
    column: item.getAttribute('data-column'),
    block: item.style.getPropertyValue('--_et-masonry-item-block-offset'),
  }));

@Component({
  selector: 'et-scenario-pin-board',
  imports: [MasonryDirective, MasonryItemDirective],
  template: `
    <div [columnWidth]="300" [gap]="0" etMasonry>
      @for (pin of pins; track pin.id) {
        <article [attr.data-test-height]="pin.height" etMasonryItem>{{ pin.id }}</article>
      }
    </div>
  `,
})
class PinBoardComponent {
  pins = [
    { id: 'p1', height: 120 },
    { id: 'p2', height: 40 },
    { id: 'p3', height: 60 },
  ];
  masonry = viewChild.required(MasonryDirective);
  items = viewChildren(MasonryItemDirective);
}

describe('masonry scenarios', () => {
  const scenario = useScenario();

  it('packs a feed of padded cards into the shortest column and gates loading more on a settled layout after a re-column', () => {
    const s = scenario();
    const harness = createMasonryHarness({ containerWidth: 1000, borderBoxOverflow: 24 });
    const fixture = TestBed.createComponent(PhotoFeedComponent);
    const host = fixture.nativeElement as HTMLElement;
    const container = () => host.querySelector<HTMLElement>('.et-masonry')!;
    const more = () => host.querySelector<HTMLButtonElement>('.more')!;

    s.tick();

    expect(container().getAttribute('role')).toBe('list');
    expect(host.querySelector('.et-masonry-item')?.getAttribute('role')).toBe('listitem');
    harness.settle(fixture);
    s.tick();

    expect(container().hasAttribute('data-settled')).toBe(true);
    expect(more().disabled).toBe(false);
    expect(host.querySelector('.column-count')?.textContent).toBe('3');
    expect(layout(host)).toEqual([
      { id: 'a', column: '0', block: '0px' },
      { id: 'b', column: '1', block: '0px' },
      { id: 'c', column: '2', block: '0px' },
      { id: 'd', column: '1', block: '116px' },
    ]);
    expect(container().style.height).toBe('300px');
    expect(host.querySelector<HTMLElement>('.et-masonry-item')!.style.width).toBe(`${(1000 - 32) / 3}px`);
    expect(host.querySelector('.et-masonry-item')?.hasAttribute('data-positioned')).toBe(true);

    more().click();
    s.tick();
    harness.settle(fixture);
    s.tick();

    expect(more().disabled).toBe(false);
    expect(layout(host).at(-1)).toEqual({ id: 'e', column: '1', block: '212px' });
    expect(
      layout(host)
        .slice(0, 4)
        .map((item) => item.column),
    ).toEqual(['0', '1', '2', '1']);

    fixture.componentInstance.columnWidth.set(480);
    s.tick();

    expect(container().hasAttribute('data-settled')).toBe(false);
    expect(more().disabled).toBe(true);

    harness.settle(fixture);
    s.tick();

    expect(more().disabled).toBe(false);
    expect(host.querySelector('.column-count')?.textContent).toBe('2');

    s.frame(3);
    s.tick(200);
  });

  it('keeps cards in their column when one grows, until the app rebalances', () => {
    const s = scenario();
    const harness = createMasonryHarness({ containerWidth: 1000 });
    const fixture = TestBed.createComponent(PhotoFeedComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    harness.settle(fixture);

    fixture.componentInstance.setHeight('b', 600);
    s.tick();
    harness.settle(fixture);
    s.tick();

    expect(layout(host).map((item) => [item.id, item.column, item.block])).toEqual([
      ['a', '0', '0px'],
      ['b', '1', '0px'],
      ['c', '2', '0px'],
      ['d', '1', '616px'],
    ]);

    host.querySelector<HTMLButtonElement>('.repack')!.click();
    s.tick();
    harness.settle(fixture);
    s.tick();

    expect(layout(host).find((item) => item.id === 'd')).toEqual({ id: 'd', column: '2', block: '216px' });

    s.frame(3);
    s.tick(200);
  });

  it('re-columns when the column width changes', () => {
    const s = scenario();
    const harness = createMasonryHarness({ containerWidth: 1000 });
    const fixture = TestBed.createComponent(PhotoFeedComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.columnWidth.set(480);
    s.tick();
    harness.settle(fixture);
    s.tick();

    expect(host.querySelector('.column-count')?.textContent).toBe('2');
    expect(layout(host).map((item) => item.column)).toEqual(['0', '1', '1', '0']);

    s.frame(3);
    s.tick(200);
  });

  it('reports an item outside a masonry and a masonry without items', () => {
    const s = scenario();

    TestBed.createComponent(StrayMasonryItemComponent);
    s.tick(1);

    s.expectError(code(MASONRY_ERROR_CODES.PART_OUTSIDE_MASONRY));

    const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');
    const context = s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;

    expect(context?.element?.classList).toContain('stray');

    s.errors.splice(0, s.errors.length);

    expect(() => {
      TestBed.createComponent(ItemlessMasonryComponent);
      s.tick(1);
    }).toThrow(code(MASONRY_ERROR_CODES.MISSING_ITEMS));

    s.tick(200);
    s.errors.splice(0, s.errors.length);
  });

  it("exposes each pin's placement to an app that reads the directives", () => {
    const s = scenario();
    const harness = createMasonryHarness({ containerWidth: 600 });
    const fixture = TestBed.createComponent(PinBoardComponent);
    const app = fixture.componentInstance;

    s.tick();
    harness.settle(fixture);
    s.tick();

    const [first, second, third] = app.items();

    expect(app.masonry().columns().count).toBe(2);
    expect(app.masonry().isSettled()).toBe(true);
    expect(app.masonry().blockSize()).toBe(120);
    expect(second!.blockSize()).toBe(40);
    expect([first, second, third].map((item) => item!.placement()?.column)).toEqual([0, 1, 1]);
    expect(app.masonry().placementOf(third!)).toEqual(third!.placement());
    expect(third!.placement()?.blockOffset).toBe(40);
    expect(third!.elementRef.nativeElement.textContent?.trim()).toBe('p3');

    s.frame(3);
    s.tick(200);
  });
});
