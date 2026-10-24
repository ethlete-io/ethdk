import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { SELECT_IMPORTS } from './select.imports';

@Component({
  template: `
    <et-select [value]="value()" multiple placeholder="Pick fruits">
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class MultiSelectHost {
  value = signal<string[]>([]);
}

type AnimateCall = { element: Element; keyframes: Keyframe[] };

describe('select chip motion', () => {
  const originalAnimate = Element.prototype.animate;
  let calls: AnimateCall[];
  let fixture: ComponentFixture<MultiSelectHost>;

  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    calls = [];
    Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
      calls.push({ element: this, keyframes: keyframes as Keyframe[] });

      return { finished: new Promise(() => undefined), cancel: () => undefined } as unknown as Animation;
    };

    fixture = TestBed.createComponent(MultiSelectHost);
    await render();
  });

  afterEach(() => {
    Element.prototype.animate = originalAnimate;
  });

  it('fades a new chip in', async () => {
    fixture.componentInstance.value.set(['apple']);
    await render();

    const chip = fixture.nativeElement.querySelector('et-chip');

    expect(calls.some((call) => call.element === chip && call.keyframes[0]?.['opacity'] === 0)).toBe(true);
  });

  it('fades a removed chip out where it was', async () => {
    fixture.componentInstance.value.set(['apple', 'banana']);
    await render();

    fixture.componentInstance.value.set(['banana']);
    await render();

    const copy = fixture.nativeElement.querySelector('.et-select-trigger-content > et-chip[aria-hidden="true"]');

    expect(copy?.textContent).toContain('Apple');
    expect(calls.some((call) => call.element === copy && call.keyframes[0]?.['opacity'] === 0)).toBe(true);
  });
});

describe('select field height motion', () => {
  const originalAnimate = Element.prototype.animate;
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  let calls: AnimateCall[];
  let resizeCallbacks: ResizeObserverCallback[];
  let triggerHeight: number;

  beforeEach(() => {
    calls = [];
    resizeCallbacks = [];
    triggerHeight = 24;

    Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
      calls.push({ element: this, keyframes: keyframes as Keyframe[] });

      return { finished: new Promise(() => undefined), cancel: () => undefined } as unknown as Animation;
    };

    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }

      observe() {
        return undefined;
      }

      unobserve() {
        return undefined;
      }

      disconnect() {
        return undefined;
      }
    } as unknown as typeof ResizeObserver;

    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const height = this.classList.contains('et-select-trigger') ? triggerHeight : 0;

      return new DOMRect(0, 0, 300, height);
    };
  });

  afterEach(() => {
    Element.prototype.animate = originalAnimate;
    globalThis.ResizeObserver = originalResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = originalRect;
  });

  it('grows the field with a transition when a chip wraps to a new line', async () => {
    const fixture = TestBed.createComponent(MultiSelectHost);

    fixture.detectChanges();
    await fixture.whenStable();

    triggerHeight = 51;

    for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);

    const trigger = fixture.nativeElement.querySelector('.et-select-trigger');
    const grow = calls.find((call) => call.element === trigger);

    expect(grow?.keyframes).toEqual([{ blockSize: '24px' }, { blockSize: '51px' }]);
  });
});
