import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { OVERLAY_REF } from './overlay-ref';
import { OverlayTitleDirective } from './overlay-title.directive';

const hostElement = document.createElement('div');

@Component({
  template: `
    @if (showFirst()) {
      <h2 id="first-title" etOverlayTitle>First</h2>
    }
    @if (showSecond()) {
      <h2 id="second-title" etOverlayTitle>Second</h2>
    }
  `,
  imports: [OverlayTitleDirective],
  providers: [{ provide: OVERLAY_REF, useValue: { config: {}, elements: { hostElement } } }],
})
class OverlayTitleTestHost {
  showFirst = signal(true);
  showSecond = signal(false);
}

describe('OverlayTitleDirective', () => {
  afterEach(() => hostElement.removeAttribute('aria-labelledby'));

  it('hands the accessible name to the next title when the labelling title leaves', async () => {
    const fixture = TestBed.createComponent(OverlayTitleTestHost);
    fixture.detectChanges();
    await Promise.resolve();

    expect(hostElement.getAttribute('aria-labelledby')).toBe('first-title');

    fixture.componentInstance.showSecond.set(true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.componentInstance.showFirst.set(false);
    fixture.detectChanges();

    expect(hostElement.getAttribute('aria-labelledby')).toBe('second-title');

    fixture.componentInstance.showSecond.set(false);
    fixture.detectChanges();

    expect(hostElement.hasAttribute('aria-labelledby')).toBe(false);
  });
});
