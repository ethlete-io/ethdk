import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { applyFaviconOverlay, FaviconOverlay, injectFaviconStore } from './favicon-binding';

describe('favicon-binding', () => {
  let injector: Injector;

  beforeEach(() => {
    // jsdom has no 2d context; stubbing it keeps the store on its "unsupported" path quietly.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    document.head.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove());
  });

  const store = () => runInInjectionContext(injector, () => injectFaviconStore());

  it('tracks the active overlay, with progress winning over a dot', () => {
    const faviconStore = store();
    const dotId = Symbol('dot');
    const progressId = Symbol('progress');

    expect(faviconStore.activeOverlay()).toBeNull();

    faviconStore.addOverlay(dotId, { kind: 'dot' });
    expect(faviconStore.activeOverlay()).toEqual({ kind: 'dot' });

    faviconStore.addOverlay(progressId, { kind: 'progress', value: 40 });
    expect(faviconStore.activeOverlay()).toEqual({ kind: 'progress', value: 40 });

    faviconStore.removeOverlay(progressId);
    expect(faviconStore.activeOverlay()).toEqual({ kind: 'dot' });

    faviconStore.removeOverlay(dotId);
    expect(faviconStore.activeOverlay()).toBeNull();
  });

  it('registers and clears an overlay from a signal binding', () => {
    const overlay = signal<FaviconOverlay | null>(null);
    const faviconStore = store();

    runInInjectionContext(injector, () => applyFaviconOverlay(overlay));
    TestBed.tick();

    expect(faviconStore.activeOverlay()).toBeNull();

    overlay.set({ kind: 'progress', value: 10 });
    TestBed.tick();
    expect(faviconStore.activeOverlay()).toEqual({ kind: 'progress', value: 10 });

    overlay.set(null);
    TestBed.tick();
    expect(faviconStore.activeOverlay()).toBeNull();
  });

  it('leaves the document alone when the platform cannot render a canvas', () => {
    const faviconStore = store();

    faviconStore.addOverlay(Symbol('dot'), { kind: 'dot' });
    TestBed.tick();

    expect(document.querySelector('link[rel~="icon"]')).toBeNull();
  });
});
