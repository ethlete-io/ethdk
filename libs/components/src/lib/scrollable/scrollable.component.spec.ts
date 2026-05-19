import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ScrollableComponent } from './scrollable.component';

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

      root = null;
      rootMargin = '';
      thresholds = [];
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

  it('renders masks and inside buttons by default', () => {
    fixture.detectChanges();

    expect(host.querySelector('et-scrollable-masks')).not.toBeNull();
    expect(host.querySelector('et-scrollable-buttons')).not.toBeNull();
  });

  it('forwards container role and custom class inputs', () => {
    fixture.componentRef.setInput('scrollableRole', 'tablist');
    fixture.componentRef.setInput('scrollableClass', 'custom-scroll-container');
    fixture.detectChanges();

    const container = host.querySelector('.et-scrollable-container');
    expect(container?.getAttribute('role')).toBe('tablist');
    expect(container?.classList.contains('custom-scroll-container')).toBe(true);
  });

  it('omits masks and buttons when their features are disabled', () => {
    fixture.componentRef.setInput('renderMasks', false);
    fixture.componentRef.setInput('renderButtons', false);
    fixture.detectChanges();

    expect(host.querySelector('et-scrollable-masks')).toBeNull();
    expect(host.querySelector('et-scrollable-buttons')).toBeNull();
  });

  it('applies sticky and darken host classes from inputs', () => {
    fixture.componentRef.setInput('stickyButtons', true);
    fixture.componentRef.setInput('darkenNonIntersectingItems', true);
    fixture.detectChanges();

    expect(host.classList.contains('et-scrollable--sticky-buttons')).toBe(true);
    expect(host.classList.contains('et-scrollable--darken-non-intersecting-items')).toBe(true);
  });
});
