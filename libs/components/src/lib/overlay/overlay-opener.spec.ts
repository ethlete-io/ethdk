import { Component, input, inputBinding, model, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import '../../test-helpers';
import { defineOverlay, defineQueryParamOverlay } from './overlay-definition';
import { injectOverlayManager } from './overlay-manager';
import { createOverlayOpener, createOverlaySingleSlot } from './overlay-opener';
import { dialogOverlayStrategy } from './strategies';
import { createOverlayUnsavedChangesGuard } from './utils/overlay-unsaved-changes-guard';

@Component({ template: 'query param overlay' })
class QueryParamOverlayComponent {
  public overlayQueryParam = model<string>();
}

const productOverlay = defineQueryParamOverlay({
  component: QueryParamOverlayComponent,
  queryParamKey: 'product',
  strategies: dialogOverlayStrategy(),
});

const undismissableOverlay = defineQueryParamOverlay({
  component: QueryParamOverlayComponent,
  queryParamKey: 'product',
  strategies: dialogOverlayStrategy(),
  disableClose: true,
});

@Component({ template: '' })
class OpenerHostComponent {
  public product = createOverlayOpener(productOverlay);
}

@Component({ template: '' })
class UndismissableOpenerHostComponent {
  public product = createOverlayOpener(undismissableOverlay);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('query param overlay opener', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
  });

  const openOverlayCount = () => TestBed.runInInjectionContext(() => injectOverlayManager().openOverlays().length);

  const setParam = async (value: string | null) => {
    await TestBed.inject(Router).navigate([], { queryParams: { product: value }, queryParamsHandling: 'merge' });
    TestBed.tick();
  };

  const createHost = async (component = OpenerHostComponent) => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();

    await setParam(null);

    return fixture;
  };

  it('opens while the query param is set and closes when it is cleared', async () => {
    const fixture = await createHost();

    await setParam('42');

    expect(openOverlayCount()).toBe(1);

    await setParam(null);
    await flushFrames();

    expect(openOverlayCount()).toBe(0);

    fixture.destroy();
  });

  it('closes an open overlay when the opener is destroyed', async () => {
    const fixture = await createHost();

    await setParam('42');

    expect(openOverlayCount()).toBe(1);

    fixture.destroy();
    TestBed.tick();
    await flushFrames();

    expect(openOverlayCount()).toBe(0);
  });

  it('closes an overlay opened with disableClose when the opener is destroyed', async () => {
    const fixture = await createHost(UndismissableOpenerHostComponent);

    await setParam('42');
    fixture.destroy();
    TestBed.tick();
    await flushFrames();

    expect(openOverlayCount()).toBe(0);
  });
});

@Component({ template: '{{ label() }}', host: { class: 'single-surface' } })
class SurfaceComponent {
  public label = input('');
  public value = signal('clean');

  public guard = createOverlayUnsavedChangesGuard({
    source: this.value,
    confirm: () => SurfaceComponent.confirm(),
  });

  static confirm: () => Promise<boolean> = () => Promise.resolve(true);
}

const surfaceOverlay = defineOverlay<SurfaceComponent, string>({
  component: SurfaceComponent,
  strategies: dialogOverlayStrategy(),
});

const otherSurfaceOverlay = defineOverlay<SurfaceComponent, string>({
  component: SurfaceComponent,
  strategies: dialogOverlayStrategy(),
});

@Component({ template: '' })
class SingleOpenerHostComponent {
  public slot = createOverlaySingleSlot();
  public surface = createOverlayOpener(surfaceOverlay, { single: 'replace' });
  public first = createOverlayOpener(surfaceOverlay, { single: this.slot });
  public second = createOverlayOpener(otherSurfaceOverlay, { single: this.slot });
}

describe('single overlay opener', () => {
  let host: SingleOpenerHostComponent;
  let resolveConfirm: (discard: boolean) => void;

  const labels = () => [...document.querySelectorAll('.single-surface')].map((element) => element.textContent);
  const withLabel = (label: string) => ({ bindings: [inputBinding('label', () => label)] });
  const makeDirty = (ref: { componentInstance: () => SurfaceComponent | null }) => {
    ref.componentInstance()?.value.set('dirty');
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    SurfaceComponent.confirm = () => new Promise<boolean>((resolve) => (resolveConfirm = resolve));

    const fixture = TestBed.createComponent(SingleOpenerHostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
  });

  afterEach(async () => {
    TestBed.runInInjectionContext(() => injectOverlayManager())
      .openOverlays()
      .forEach((ref) => ref.forceClose());
    await flushFrames();
  });

  it('replaces an open overlay that has no reason to stay', async () => {
    host.surface.open(withLabel('a'));
    await flushFrames();

    const replacement = host.surface.open(withLabel('b'));
    await flushFrames();

    expect(replacement).not.toBeNull();
    expect(labels()).toEqual(['b']);
  });

  it('opens the replacement once the unsaved-changes confirm discards the previous one', async () => {
    const previous = host.surface.open(withLabel('a'));
    await flushFrames();
    makeDirty(previous!);

    expect(host.surface.open(withLabel('b'))).toBeNull();
    await flushFrames();
    expect(labels()).toEqual(['a']);

    resolveConfirm(true);
    await flushFrames();

    expect(labels()).toEqual(['b']);
  });

  it('drops the replacement when the confirm keeps the previous one, even if it closes later', async () => {
    const previous = host.surface.open(withLabel('a'));
    await flushFrames();
    makeDirty(previous!);

    host.surface.open(withLabel('b'));
    resolveConfirm(false);
    await flushFrames();

    expect(labels()).toEqual(['a']);

    previous!.componentInstance()?.value.set('clean');
    TestBed.tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushFrames();

    expect(labels()).toEqual([]);
  });

  it('keeps only the latest open requested while a confirm is pending', async () => {
    const previous = host.surface.open(withLabel('a'));
    await flushFrames();
    makeDirty(previous!);

    host.surface.open(withLabel('b'));
    host.surface.open(withLabel('c'));
    resolveConfirm(true);
    await flushFrames();

    expect(labels()).toEqual(['c']);
  });

  it('replaces across openers that share a slot', async () => {
    host.first.open(withLabel('a'));
    await flushFrames();

    host.second.open(withLabel('b'));
    await flushFrames();

    expect(labels()).toEqual(['b']);
  });
});
