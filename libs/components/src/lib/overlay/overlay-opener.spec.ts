import { Component, input, inputBinding, model, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { filter, firstValueFrom, of } from 'rxjs';
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
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), provideLocationMocks()],
    });
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

  it('keeps a query-param overlay open on a path change that keeps its param', async () => {
    const fixture = await createHost();

    await setParam('42');
    await TestBed.inject(Router).navigate(['/other'], { queryParamsHandling: 'preserve' });
    TestBed.tick();
    await flushFrames();

    expect(openOverlayCount()).toBe(1);

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

  it('closes an overlay whose close guard vetoes when the opener is destroyed', async () => {
    const fixture = await createHost();

    await setParam('42');
    TestBed.runInInjectionContext(() =>
      injectOverlayManager()
        .openOverlays()[0]
        ?.registerCloseGuard(() => false),
    );
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

  const openRef = () => TestBed.runInInjectionContext(() => injectOverlayManager().openOverlays()[0]);

  const waitForClose = async () => {
    for (let attempt = 0; attempt < 10 && openOverlayCount() > 0; attempt++) {
      await flushFrames();
    }
  };

  const productParam = () => TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams['product'];

  it('puts the last model value back into the URL when a close guard vetoes a cleared param', async () => {
    const fixture = await createHost();

    await setParam('42');

    const ref = openRef();
    await firstValueFrom(ref?.afterOpened() ?? of(undefined), { defaultValue: undefined });
    TestBed.tick();

    (ref?.componentInstance() as QueryParamOverlayComponent).overlayQueryParam.set('tab-b');
    TestBed.tick();
    await fixture.whenStable();

    let vetoing = true;

    ref?.registerCloseGuard(() => !vetoing);

    await setParam(null);
    await fixture.whenStable();
    TestBed.tick();

    expect(openOverlayCount()).toBe(1);
    expect(productParam()).toBe('tab-b');

    vetoing = false;
    await setParam(null);
    await waitForClose();

    expect(openOverlayCount()).toBe(0);
    expect(productParam()).toBeUndefined();

    fixture.destroy();
  });

  it('keeps the param while a close guard vetoes a close from the overlay itself', async () => {
    const fixture = await createHost();

    await setParam('42');

    const ref = openRef();
    let vetoing = true;

    ref?.registerCloseGuard(() => !vetoing);

    ref?.close();
    TestBed.tick();
    await fixture.whenStable();

    expect(openOverlayCount()).toBe(1);
    expect(productParam()).toBe('42');

    vetoing = false;
    ref?.close();
    TestBed.tick();
    await fixture.whenStable();
    await waitForClose();

    expect(openOverlayCount()).toBe(0);
    expect(productParam()).toBeUndefined();

    fixture.destroy();
  });

  it('replaces the history entry on a model change, so one Back closes the overlay', async () => {
    TestBed.inject(Router).setUpLocationChangeListener();
    const fixture = await createHost();
    const location = TestBed.inject(Location);

    await setParam('42');

    const ref = TestBed.runInInjectionContext(() => injectOverlayManager().openOverlays()[0]);
    await firstValueFrom(ref?.afterOpened() ?? of(undefined), { defaultValue: undefined });
    TestBed.tick();

    const instance = ref?.componentInstance() as QueryParamOverlayComponent;

    for (const value of ['tab-a', 'tab-b']) {
      instance.overlayQueryParam.set(value);
      TestBed.tick();
      await fixture.whenStable();
    }

    expect(location.path()).toBe('/?product=tab-b');

    const router = TestBed.inject(Router);
    const navigated = firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd)));
    location.back();
    await navigated;
    TestBed.tick();

    for (let attempt = 0; attempt < 10 && openOverlayCount() > 0; attempt++) {
      await flushFrames();
    }

    expect(location.path()).toBe('/');
    expect(openOverlayCount()).toBe(0);

    fixture.destroy();
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

@Component({ template: 'plain overlay' })
class PlainOverlayComponent {}

const plainOverlay = defineOverlay<PlainOverlayComponent, string>({
  component: PlainOverlayComponent,
  ariaLabel: 'definition',
  hostClass: 'from-definition',
});

@Component({ template: '' })
class PlainOpenerHostComponent {
  public openerClosed: (string | null)[] = [];
  public plain = createOverlayOpener(plainOverlay, {
    ariaLabel: 'opener',
    hostClass: 'from-opener',
    afterClosed: (result) => this.openerClosed.push(result),
  });
}

describe('overlay opener', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PlainOpenerHostComponent>>;
  let host: PlainOpenerHostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(PlainOpenerHostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
  });

  afterEach(async () => {
    TestBed.runInInjectionContext(() => injectOverlayManager())
      .openOverlays()
      .forEach((ref) => ref.forceClose());
    await flushFrames();
  });

  it('runs both the opener and the per-open afterClosed with the result', async () => {
    const openClosed: (string | null)[] = [];
    const ref = host.plain.open({ afterClosed: (result) => openClosed.push(result) });
    await flushFrames();

    ref.close('saved');
    await flushFrames();

    expect(host.openerClosed).toEqual(['saved']);
    expect(openClosed).toEqual(['saved']);
  });

  it('reports a close without a result as null', async () => {
    const ref = host.plain.open();
    await flushFrames();

    ref.close();
    await flushFrames();

    expect(host.openerClosed).toEqual([null]);
  });

  it('merges definition, opener and per-open config in that order', () => {
    const ref = host.plain.open({ ariaLabel: 'per-open', hostClass: 'from-open' });

    expect(ref.config.ariaLabel).toBe('per-open');
    expect([ref.config.hostClass].flat()).toEqual(['from-definition', 'from-opener', 'from-open']);
  });

  it('falls back to the host view container', () => {
    const ref = host.plain.open();

    expect(ref.config.viewContainerRef).toBeDefined();
  });

  it('still reports a close that started before its host was destroyed', async () => {
    const ref = host.plain.open();
    await flushFrames();

    ref.close('saved');
    fixture.destroy();
    await flushFrames();

    expect(host.openerClosed).toEqual(['saved']);
  });

  it('stops calling the opener callbacks once its host is destroyed', async () => {
    const ref = host.plain.open();
    await flushFrames();

    fixture.destroy();
    ref.close('late');
    await flushFrames();

    expect(host.openerClosed).toEqual([]);
  });
});
