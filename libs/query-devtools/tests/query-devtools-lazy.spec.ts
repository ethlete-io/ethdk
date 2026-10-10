import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideQueryDevtools, ɵresetQueryDevtoolsForTesting } from '@ethlete/query';
import { QueryDevtoolsComponent } from '../src/lib/query-devtools.component';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryDevtoolsLazyComponent } from '../lazy/query-devtools-lazy.component';
import { QUERY_DEVTOOLS_VIEW_STATE_KEY, wasQueryDevtoolsOpen } from '../toggle/query-devtools-view-state';

const pressShortcut = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', ctrlKey: true, altKey: true }));

// The spec runner shares one module graph between the files of a worker, so the latch
// `provideQueryDevtools()` sets would leak into the next file without this.
afterEach(() => ɵresetQueryDevtoolsForTesting());

describe('QueryDevtoolsLazyComponent without provideQueryDevtools()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsLazyComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('should warn once that the provider is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await TestBed.createComponent(QueryDevtoolsLazyComponent).whenStable();
    await TestBed.createComponent(QueryDevtoolsLazyComponent).whenStable();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('provideQueryDevtools()');

    warn.mockRestore();
  });

  it('should render nothing', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('et-query-devtools-toggle')).toBeNull();
    expect(host.querySelector('et-query-devtools')).toBeNull();
  });

  it('should not open the panel on the keyboard shortcut', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    pressShortcut();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('et-query-devtools')).toBeNull();
  });
});

describe('QueryDevtoolsLazyComponent with provideQueryDevtools()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsLazyComponent],
      providers: [provideZonelessChangeDetection(), provideQueryDevtools()],
    });
  });

  it('should render the floating toggle', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('et-query-devtools-toggle')).not.toBeNull();
  });

  it('should leave an AltGr+Q keypress to the page', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    const altGrQ = new KeyboardEvent('keydown', {
      key: '@',
      code: 'KeyQ',
      ctrlKey: true,
      altKey: true,
      modifierAltGraph: true,
      cancelable: true,
    });
    document.dispatchEvent(altGrQ);

    expect(altGrQ.defaultPrevented).toBe(false);
  });

  it('should claim the Ctrl+Alt+Q keypress', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    const ctrlAltQ = new KeyboardEvent('keydown', {
      key: 'q',
      code: 'KeyQ',
      ctrlKey: true,
      altKey: true,
      cancelable: true,
    });
    document.dispatchEvent(ctrlAltQ);

    expect(ctrlAltQ.defaultPrevented).toBe(true);
  });
});

describe('QueryDevtoolsLazyComponent loading the panel', () => {
  beforeEach(() => {
    if (!globalThis.ResizeObserver) {
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        value: class {
          observe() {
            return undefined;
          }
          unobserve() {
            return undefined;
          }
          disconnect() {
            return undefined;
          }
        },
      });
    }

    if (!globalThis.matchMedia) {
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
        }),
      });
    }

    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsLazyComponent],
      providers: [provideZonelessChangeDetection(), provideQueryDevtools()],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
  });

  const settle = async (fixture: ComponentFixture<QueryDevtoolsLazyComponent>) => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const panelOpen = (fixture: ComponentFixture<QueryDevtoolsLazyComponent>) => {
    const panel = fixture.debugElement.query(By.directive(QueryDevtoolsComponent));

    if (!panel) return null;

    return (panel.componentInstance as { open: () => boolean }).open();
  };

  it('should not load the panel before it is asked for', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await settle(fixture);

    expect(panelOpen(fixture)).toBeNull();
  });

  it('should open the panel on the first shortcut and close it on the second', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await settle(fixture);

    pressShortcut();
    await settle(fixture);

    expect(panelOpen(fixture)).toBe(true);

    pressShortcut();
    await settle(fixture);

    expect(panelOpen(fixture)).toBe(false);
  });

  it('should open the panel from the toggle button', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await settle(fixture);

    const toggle = (fixture.nativeElement as HTMLElement).querySelector('et-query-devtools-toggle');
    toggle?.shadowRoot?.querySelector('button')?.click();
    await settle(fixture);

    expect(panelOpen(fixture)).toBe(true);
  });

  it('should restore a panel that was open when the view state was stored', async () => {
    sessionStorage.setItem(QUERY_DEVTOOLS_VIEW_STATE_KEY, JSON.stringify({ open: true }));

    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await settle(fixture);

    expect(panelOpen(fixture)).toBe(true);
  });

  it('should leave a panel closed that was stored closed', async () => {
    sessionStorage.setItem(QUERY_DEVTOOLS_VIEW_STATE_KEY, JSON.stringify({ open: false }));

    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await settle(fixture);

    expect(panelOpen(fixture)).toBeNull();
  });

  it('should store the closed state once the panel is closed', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await settle(fixture);

    pressShortcut();
    await settle(fixture);
    pressShortcut();
    await settle(fixture);

    expect(wasQueryDevtoolsOpen()).toBe(false);
  });
});

describe('QueryDevtoolsLazyComponent when the panel chunk fails to load', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsLazyComponent],
      providers: [provideZonelessChangeDetection(), provideQueryDevtools()],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('should render a toggle that names the failure and reloads the page on click', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    const [deferBlock] = await fixture.getDeferBlocks();
    await deferBlock?.render(DeferBlockState.Error);

    const reload = vi
      .spyOn(fixture.componentInstance as unknown as { reload: () => void }, 'reload')
      .mockImplementation(() => undefined);
    const button = (fixture.nativeElement as HTMLElement)
      .querySelector('et-query-devtools-toggle')
      ?.shadowRoot?.querySelector('button');

    expect(button?.title).toContain('failed to load');

    button?.click();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
