import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CarouselDirective } from './carousel.directive';

@Component({
  template: '',
  hostDirectives: [CarouselDirective],
})
class HostComponent {}

describe('CarouselDirective', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('applies a goTo() called during the initial navigation lock once the lock ends', () => {
    vi.useFakeTimers();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const carousel = fixture.debugElement.injector.get(CarouselDirective);

    expect(carousel.isNavigationLocked()).toBe(true);

    carousel.goTo(1);
    carousel.goTo(2);

    vi.advanceTimersByTime(450);
    fixture.detectChanges();
    vi.advanceTimersByTime(50);
    fixture.detectChanges();

    expect(carousel.activeIndex()).toBe(2);
  });
});
