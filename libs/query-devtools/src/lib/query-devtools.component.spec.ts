import { provideZonelessChangeDetection, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryDevtoolsComponent } from './query-devtools.component';

class ResizeObserverMock {
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

const installJsdomShims = () => {
  if (!globalThis.ResizeObserver) {
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: ResizeObserverMock });
  }

  if (!globalThis.matchMedia) {
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
};

const mount = (startOpen: boolean) => {
  const fixture = TestBed.createComponent(QueryDevtoolsComponent);
  fixture.componentRef.setInput('startOpen', startOpen);
  fixture.detectChanges();

  return fixture;
};

describe('QueryDevtoolsComponent', () => {
  beforeEach(() => {
    installJsdomShims();
    // Only the timer APIs, never `Date`: a faked clock outlives this file's teardown badly enough that a
    // later spec's `new Date(...)` serializes as `{}`, and nothing here needs wall-clock control.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('should not schedule a recurring timer while the panel is closed', () => {
    const before = vi.getTimerCount();
    const fixture = mount(false);

    expect(vi.getTimerCount()).toBe(before);

    vi.advanceTimersByTime(5000);

    expect(vi.getTimerCount()).toBe(before);

    fixture.destroy();
  });

  it('should schedule the clock only while the panel is open', () => {
    const fixture = mount(true);
    const whileOpen = vi.getTimerCount();

    expect(whileOpen).toBeGreaterThan(0);

    (fixture.componentInstance as unknown as { open: WritableSignal<boolean> }).open.set(false);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);

    expect(vi.getTimerCount()).toBeLessThan(whileOpen);

    fixture.destroy();
  });
});
