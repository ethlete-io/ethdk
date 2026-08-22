import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ScrollableComponent } from './scrollable.component';
import {
  SCROLLABLE_DARKEN_IMPORTS,
  SCROLLABLE_DRAG_IMPORTS,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
} from './scrollable.imports';

const ensureObserverMocks = () => {
  const windowWithObservers = window as typeof window & {
    ResizeObserver?: typeof ResizeObserver;
    IntersectionObserver?: typeof IntersectionObserver;
  };

  if (!windowWithObservers.ResizeObserver) {
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        void callback;
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
    }

    windowWithObservers.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
  }

  if (!windowWithObservers.IntersectionObserver) {
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        void callback;
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

      takeRecords() {
        return [];
      }

      root: Element | Document | null = null;
      rootMargin = '';
      scrollMargin = '';
      thresholds: ReadonlyArray<number> = [];
    }

    windowWithObservers.IntersectionObserver = IntersectionObserverMock as typeof IntersectionObserver;
  }
};

describe('ScrollableComponent', () => {
  let fixture: ComponentFixture<ScrollableComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    ensureObserverMocks();

    TestBed.configureTestingModule({
      imports: [ScrollableComponent],
    });

    fixture = TestBed.createComponent(ScrollableComponent);
    host = fixture.nativeElement;
  });

  it('renders masks by default and no chrome until a feature registers some', () => {
    fixture.detectChanges();

    expect(host.querySelector('et-scrollable-masks')).not.toBeNull();
    expect(host.querySelector('et-scrollable-buttons')).toBeNull();
    expect(host.querySelector('et-scrollable-navigation')).toBeNull();
  });

  it('forwards container role and custom class inputs', () => {
    fixture.componentRef.setInput('scrollableRole', 'tablist');
    fixture.componentRef.setInput('scrollableClass', 'custom-scroll-container');
    fixture.detectChanges();

    const container = host.querySelector('.et-scrollable-container');
    expect(container?.getAttribute('role')).toBe('tablist');
    expect(container?.classList.contains('custom-scroll-container')).toBe(true);
  });

  it('omits masks when renderMasks is off', () => {
    fixture.componentRef.setInput('renderMasks', false);
    fixture.detectChanges();

    expect(host.querySelector('et-scrollable-masks')).toBeNull();
  });
});

describe('ScrollableComponent opt-in features', () => {
  @Component({
    template: `
      <et-scrollable
        [etScrollableButtons]="{ sticky: true }"
        etScrollableDarken
        etScrollableDrag
        etScrollableSnap
      ></et-scrollable>
    `,
    imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS, SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_DARKEN_IMPORTS],
  })
  class TestHostComponent {}

  it('stamps the buttons and carries the feature host classes', () => {
    ensureObserverMocks();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const scrollable = fixture.nativeElement.querySelector('et-scrollable') as HTMLElement;

    expect(scrollable.querySelector('et-scrollable-buttons')).not.toBeNull();
    expect(scrollable.classList.contains('et-scrollable--sticky-buttons')).toBe(true);
    expect(scrollable.classList.contains('et-scrollable--darken-non-intersecting-items')).toBe(true);
    expect(scrollable.getAttribute('snap')).toBe('');
  });
});
