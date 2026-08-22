import { Component, model } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import '../../test-helpers';
import { defineQueryParamOverlay } from './overlay-definition';
import { injectOverlayManager } from './overlay-manager';
import { createOverlayOpener } from './overlay-opener';
import { dialogOverlayStrategy } from './strategies';

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
