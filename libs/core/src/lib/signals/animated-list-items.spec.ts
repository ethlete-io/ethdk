import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { injectAnimatedListItems } from './animated-list-items';

type RecordedAnimation = {
  target: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finish: () => void;
};

@Component({
  selector: 'et-animated-list-items-host',
  template: `
    <div #list>
      @for (item of items(); track item) {
        <div
          [attr.data-top]="$index * 10"
          [id]="'row-' + item"
          [attr.data-filtered]="filtered().includes(item) || null"
          class="row"
        >
          {{ item }}
        </div>
      }
    </div>
  `,
})
class AnimatedListItemsHostComponent {
  list = viewChild.required<ElementRef<HTMLElement>>('list');
  items = signal(['a', 'b', 'c']);
  filtered = signal<string[]>([]);

  constructor() {
    injectAnimatedListItems({
      host: this.list,
      items: '.row',
      moveDuration: 300,
      moveEasing: 'linear',
      maxMoves: 2,
      attributes: ['data-filtered'],
    });
  }
}

describe('injectAnimatedListItems', () => {
  let fixture: ComponentFixture<AnimatedListItemsHostComponent>;
  let animations: RecordedAnimation[];
  let originalAnimate: typeof HTMLElement.prototype.animate;
  let originalMatchMedia: typeof window.matchMedia;

  const rows = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.row'));
  const row = (id: string) => rows().find((element) => element.id === `row-${id}`);
  const animationsOf = (target: HTMLElement | undefined) =>
    animations.filter((animation) => animation.target === target);
  const copies = () => rows().filter((element) => element.getAttribute('aria-hidden') === 'true');

  const update = async (items: string[]) => {
    fixture.componentInstance.items.set(items);
    fixture.detectChanges();
    await Promise.resolve();
  };

  const setup = (options?: { reducedMotion?: boolean }) => {
    if (options?.reducedMotion) {
      window.matchMedia = (() => ({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })) as unknown as typeof window.matchMedia;
    }

    fixture = TestBed.createComponent(AnimatedListItemsHostComponent);
    fixture.detectChanges();
    fixture.detectChanges();
  };

  const originalRect = HTMLElement.prototype.getBoundingClientRect;

  beforeAll(() => {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const top = this.style.position === 'absolute' ? parseFloat(this.style.top) : Number(this.dataset['top'] ?? 0);

      return { top, left: 0, width: 0, height: 0 } as DOMRect;
    };
  });

  afterAll(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect;
  });

  beforeEach(() => {
    animations = [];
    originalAnimate = HTMLElement.prototype.animate;
    originalMatchMedia = window.matchMedia;

    HTMLElement.prototype.animate = function (this: HTMLElement, keyframes, options) {
      let onFinished: () => void = () => undefined;
      const animation = {
        finished: { then: (callback: () => void) => ((onFinished = callback), { catch: () => undefined }) },
        cancel: () => undefined,
      };

      animations.push({
        target: this,
        keyframes: keyframes as Keyframe[],
        options: options as KeyframeAnimationOptions,
        finish: () => onFinished(),
      });

      return animation as unknown as Animation;
    } as typeof HTMLElement.prototype.animate;
  });

  afterEach(() => {
    HTMLElement.prototype.animate = originalAnimate;
    window.matchMedia = originalMatchMedia;
  });

  it('does not animate the first render', () => {
    setup();

    expect(animations).toEqual([]);
  });

  it('slides an item that stays from its old spot to its new one', async () => {
    setup();
    await update(['b', 'a', 'c']);

    expect(animationsOf(row('a'))[0]?.keyframes).toEqual([
      { transform: 'translate(0px, -10px)' },
      { transform: 'none' },
    ]);
    expect(animationsOf(row('b'))[0]?.keyframes).toEqual([
      { transform: 'translate(0px, 10px)' },
      { transform: 'none' },
    ]);
    expect(animationsOf(row('a'))[0]?.options).toEqual({ duration: 300, easing: 'linear' });
    expect(animationsOf(row('c'))).toEqual([]);
  });

  it('fades in a new item', async () => {
    setup();
    await update(['a', 'b', 'c', 'd']);

    expect(animationsOf(row('d'))[0]?.keyframes).toEqual([{ opacity: 0, offset: 0 }]);
  });

  it('gives a removed item the width it had after the host last resized', async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    let notify: () => void = () => undefined;

    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe = () => undefined;
      disconnect = () => undefined;
    } as unknown as typeof ResizeObserver;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return Number(this.closest<HTMLElement>('[data-width]')?.dataset['width'] ?? 0);
      },
    });

    try {
      setup();
      fixture.componentInstance.list().nativeElement.dataset['width'] = '200';
      notify();
      await update(['a', 'c']);

      expect(copies()[0]?.style.width).toBe('200px');
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
      if (offsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth);
    }
  });

  it('fades out a removed item as an inert copy at its old spot', async () => {
    setup();
    await update(['a', 'c']);

    const [copy] = copies();

    expect(copy?.id).toBe('');
    expect(copy?.inert).toBe(true);
    expect(copy?.style.top).toBe('10px');
    expect(animationsOf(copy)[0]?.keyframes).toEqual([{ opacity: 0 }]);

    animationsOf(copy)[0]?.finish();

    expect(copies()).toEqual([]);
  });

  it('only fades when more items move than allowed', async () => {
    setup();
    await update(['x', 'a', 'b', 'c']);

    expect(animationsOf(row('a'))).toEqual([]);
    expect(animationsOf(row('x'))[0]?.keyframes).toEqual([{ opacity: 0, offset: 0 }]);
  });

  it('treats an item hidden by a watched attribute as removed', async () => {
    const originalCheckVisibility = HTMLElement.prototype.checkVisibility;

    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return !this.hasAttribute('data-filtered');
    };

    try {
      setup();
      fixture.componentInstance.filtered.set(['b']);
      fixture.detectChanges();
      await Promise.resolve();

      const [copy] = copies();

      expect(copy?.hasAttribute('data-filtered')).toBe(false);
      expect(copy?.style.top).toBe('10px');
      expect(animationsOf(copy)[0]?.keyframes).toEqual([{ opacity: 0 }]);
    } finally {
      HTMLElement.prototype.checkVisibility = originalCheckVisibility;
    }
  });

  it('gives a copy the styles its item had from selectors that no longer match the copy', async () => {
    const originalCheckVisibility = HTMLElement.prototype.checkVisibility;
    const sheet = document.createElement('style');

    sheet.textContent = '.row[data-filtered] { text-transform: uppercase; padding-top: 7px; }';
    document.head.append(sheet);
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return !this.hasAttribute('data-filtered');
    };

    try {
      setup();
      fixture.componentInstance.filtered.set(['b']);
      fixture.detectChanges();
      await Promise.resolve();

      const [copy] = copies();

      expect(copy?.style.textTransform).toBe('uppercase');
      expect(copy?.style.paddingTop).toBe('7px');
    } finally {
      HTMLElement.prototype.checkVisibility = originalCheckVisibility;
      sheet.remove();
    }
  });

  it('only fades with reduced motion', async () => {
    setup({ reducedMotion: true });
    await update(['b', 'a', 'd']);

    expect(animationsOf(row('a'))).toEqual([]);
    expect(animationsOf(row('d'))[0]?.keyframes).toEqual([{ opacity: 0, offset: 0 }]);
    expect(copies()).toHaveLength(1);
  });
});
