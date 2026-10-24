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
