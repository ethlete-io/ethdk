import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ScrollableComponent } from './scrollable.component';

describe('ScrollableComponent', () => {
  let fixture: ComponentFixture<ScrollableComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    // Mock ResizeObserver for jsdom environment
    if (!window.ResizeObserver) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).ResizeObserver = class ResizeObserver {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(callback: ResizeObserverCallback) {
          // Mock constructor
        }

        observe() {
          // Mock observe
        }

        unobserve() {
          // Mock unobserve
        }

        disconnect() {
          // Mock disconnect
        }
      };
    }

    // Mock IntersectionObserver for jsdom environment
    if (!window.IntersectionObserver) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).IntersectionObserver = class IntersectionObserver {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(callback: IntersectionObserverCallback) {
          // Mock constructor
        }

        observe() {
          // Mock observe
        }

        unobserve() {
          // Mock unobserve
        }

        disconnect() {
          // Mock disconnect
        }
      };
    }

    TestBed.configureTestingModule({
      imports: [ScrollableComponent],
    });
    fixture = TestBed.createComponent(ScrollableComponent);
    host = fixture.nativeElement;
  });

  it('has et-scrollable class on host', () => {
    fixture.detectChanges();
    expect(host.classList.contains('et-scrollable')).toBe(true);
  });

  it('renders without errors', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
