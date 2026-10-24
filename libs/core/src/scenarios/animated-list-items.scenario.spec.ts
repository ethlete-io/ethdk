import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectAnimatedListItems } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-animated-list-items',
  template: `
    <div #list class="list">
      @for (group of groups; track group) {
        <div class="group">
          <div [attr.data-filtered]="filtered().includes(group) || null" class="label">{{ group }}</div>
        </div>
      }
    </div>
  `,
})
class AnimatedListItemsHostComponent {
  list = viewChild.required<ElementRef<HTMLElement>>('list');
  groups = ['fruit', 'veg'];
  filtered = signal<string[]>([]);

  constructor() {
    injectAnimatedListItems({ host: this.list, items: '.label', attributes: ['data-filtered'] });
  }
}

@Component({
  selector: 'et-scenario-animated-list-items-empty',
  template: `
    <div #list class="list">
      @for (item of items(); track item) {
        <div class="row">{{ item }}</div>
      } @empty {
        <div class="row row--empty">No results</div>
      }
    </div>
  `,
})
class AnimatedListItemsEmptyHostComponent {
  list = viewChild.required<ElementRef<HTMLElement>>('list');
  items = signal(['fruit', 'veg']);

  constructor() {
    injectAnimatedListItems({ host: this.list, items: '.row', leaveDuration: 60 });
  }
}

@Component({
  selector: 'et-scenario-animated-list-items-silent',
  template: `
    <div #list class="list">
      @for (item of items(); track item) {
        <div class="row">{{ item }}</div>
      }
    </div>
  `,
})
class AnimatedListItemsSilentHostComponent {
  list = viewChild.required<ElementRef<HTMLElement>>('list');
  items = signal(['fruit', 'veg']);
  animates = signal(true);

  constructor() {
    injectAnimatedListItems({ host: this.list, items: '.row', animateChange: () => this.animates() });
  }
}

describe('animated list items scenarios', () => {
  const scenario = useScenario();
  const originalAnimate = HTMLElement.prototype.animate;
  const originalCheckVisibility = HTMLElement.prototype.checkVisibility;
  let finishLeaves: (() => void)[];
  let animations: { target: HTMLElement; options: KeyframeAnimationOptions | undefined }[];
  let style: HTMLStyleElement;

  beforeEach(() => {
    finishLeaves = [];
    animations = [];

    HTMLElement.prototype.animate = function (
      this: HTMLElement,
      _keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ) {
      animations.push({ target: this, options: typeof options === 'number' ? { duration: options } : options });

      let finish: () => void = () => undefined;
      const finished = new Promise<void>((resolve) => (finish = resolve));

      finishLeaves.push(finish);

      return { finished, cancel: () => undefined } as unknown as Animation;
    } as HTMLElement['animate'];
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return !this.hasAttribute('data-filtered');
    };

    style = document.createElement('style');
    style.textContent = '.group .label { text-transform: uppercase; padding-top: 7px; }';
    document.head.append(style);
  });

  afterEach(() => {
    HTMLElement.prototype.animate = originalAnimate;
    HTMLElement.prototype.checkVisibility = originalCheckVisibility;
    style.remove();
  });

  it('keeps the context styles on the fade-out copy of an item hidden by an attribute', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AnimatedListItemsHostComponent);
    const list = fixture.componentInstance.list().nativeElement;

    fixture.detectChanges();
    await s.settle();

    const label = list.querySelector<HTMLElement>('.group .label');

    expect(label && getComputedStyle(label).textTransform).toBe('uppercase');

    fixture.componentInstance.filtered.set(['fruit']);
    fixture.detectChanges();
    await s.settle();

    const copy = list.querySelector<HTMLElement>(':scope > .label');

    expect(copy).not.toBeNull();
    expect(copy?.parentElement).toBe(list);
    expect(copy?.inert).toBe(true);
    expect(copy?.getAttribute('aria-hidden')).toBe('true');
    expect(copy?.hasAttribute('data-filtered')).toBe(false);
    expect(copy?.style.textTransform).toBe('uppercase');
    expect(copy?.style.paddingTop).toBe('7px');

    for (const finish of finishLeaves) finish();

    await s.settle();

    expect(list.querySelector(':scope > .label')).toBeNull();
  });

  it('fades a new item in only after the removed items have faded out', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AnimatedListItemsEmptyHostComponent);
    const list = fixture.componentInstance.list().nativeElement;

    fixture.detectChanges();
    await s.settle();

    fixture.componentInstance.items.set([]);
    fixture.detectChanges();
    await s.settle();

    const empty = list.querySelector<HTMLElement>('.row--empty:not([inert])');
    const enter = animations.find((animation) => animation.target === empty);
    const leave = animations.find((animation) => animation.target.inert);

    expect(leave?.options?.duration).toBe(60);
    expect(enter?.options?.delay).toBe(60);

    for (const finish of finishLeaves) finish();

    await s.settle();
  });

  it('takes a change without motion when animateChange returns false, and measures it', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AnimatedListItemsSilentHostComponent);
    const host = fixture.componentInstance;
    const list = host.list().nativeElement;

    fixture.detectChanges();
    await s.settle();

    host.animates.set(false);
    host.items.set(['fruit', 'fig']);
    fixture.detectChanges();
    await s.settle();

    expect(animations).toEqual([]);
    expect(list.querySelector('[inert]')).toBeNull();

    host.animates.set(true);
    host.items.set(['fruit', 'fig', 'kiwi']);
    fixture.detectChanges();
    await s.settle();

    expect(animations.map((animation) => animation.target.textContent?.trim())).toEqual(['kiwi']);
    expect(list.querySelector('[inert]')).toBeNull();
  });
});
