import { Component, booleanAttribute, input, inputBinding, model, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter } from '@angular/router';
import '../../test-helpers';
import { defineOverlay, defineQueryParamOverlay } from './overlay-definition';
import { OverlayInputs, overlayResult } from './overlay-inputs';
import { injectOverlayManager } from './overlay-manager';
import { createOverlayOpener } from './overlay-opener';
import { OverlayRef } from './overlay-ref';
import { dialogOverlayStrategy } from './strategies';

type ProductResult = { saved: boolean };

@Component({ template: '{{ productId() }}|{{ heading() }}|{{ compact() }}' })
class ProductOverlayComponent {
  public productId = input.required<number>();
  // eslint-disable-next-line @angular-eslint/no-input-rename
  public heading = input('', { alias: 'title' });
  public compact = input(false, { transform: booleanAttribute });
  public note = model<string>();
  public plain = signal('not an input');
}

@Component({ template: '' })
class QueryParamProductOverlayComponent {
  public overlayQueryParam = model<string>();
  public productId = input<number>();
}

const productOverlay = defineOverlay({
  component: ProductOverlayComponent,
  result: overlayResult<ProductResult>(),
  strategies: dialogOverlayStrategy(),
});

const queryParamProductOverlay = defineQueryParamOverlay({
  component: QueryParamProductOverlayComponent,
  queryParamKey: 'product',
  result: overlayResult<ProductResult>(),
});

const productId = signal(1);

@Component({ template: '' })
class OpenerHostComponent {
  public product = createOverlayOpener(productOverlay, { inputs: { heading: () => 'From the opener' } });
}

const assertType = <T>(value: T) => value;

describe('overlay typed inputs and result', () => {
  let refs: { close: () => void }[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideLocationMocks()] });
  });

  afterEach(() => {
    for (const ref of refs) ref.close();
    refs = [];
  });

  const track = <T extends { close: () => void }>(ref: T) => {
    refs.push(ref);
    TestBed.tick();

    return ref;
  };

  it('binds inputs by property name, resolving aliases, on a plain open', () => {
    const ref = track(
      TestBed.runInInjectionContext(() =>
        injectOverlayManager().open(ProductOverlayComponent, {
          inputs: { productId: () => productId(), heading: () => 'Details', compact: () => '' },
        }),
      ),
    );

    const instance = ref.componentInstance();

    expect(instance?.productId()).toBe(1);
    expect(instance?.heading()).toBe('Details');
    expect(instance?.compact()).toBe(true);
  });

  it('re-reads the getter like an inputBinding', () => {
    const ref = track(
      TestBed.runInInjectionContext(() =>
        injectOverlayManager().open(ProductOverlayComponent, {
          inputs: { productId: () => productId() },
          strategies: dialogOverlayStrategy(),
        }),
      ),
    );

    productId.set(2);
    TestBed.tick();

    expect(ref.componentInstance()?.productId()).toBe(2);
    productId.set(1);
  });

  it('lets bindings win over inputs for the same input', () => {
    const ref = track(
      TestBed.runInInjectionContext(() =>
        injectOverlayManager().open(ProductOverlayComponent, {
          inputs: { productId: () => 1 },
          bindings: [inputBinding('productId', () => 3)],
        }),
      ),
    );

    expect(ref.componentInstance()?.productId()).toBe(3);
  });

  it('merges opener and per-open inputs through a definition opener', () => {
    const fixture = TestBed.createComponent(OpenerHostComponent);
    fixture.detectChanges();

    const ref = track(fixture.componentInstance.product.open({ inputs: { productId: () => 7 } }));
    const instance = ref.componentInstance();

    expect(instance?.productId()).toBe(7);
    expect(instance?.heading()).toBe('From the opener');

    fixture.destroy();
  });

  it('infers the result type from the marker', () => {
    const fixture = TestBed.createComponent(OpenerHostComponent);
    fixture.detectChanges();

    const ref = track(fixture.componentInstance.product.open({ inputs: { productId: () => 1 } }));

    assertType<OverlayRef<ProductOverlayComponent, ProductResult>>(ref);
    // @ts-expect-error - the result is typed, a string is not a ProductResult
    ref.close('saved');
    assertType<() => OverlayRef<QueryParamProductOverlayComponent, ProductResult>>(queryParamProductOverlay.injectRef);

    const managerRef = track(
      TestBed.runInInjectionContext(() =>
        injectOverlayManager().open(ProductOverlayComponent, {
          inputs: { productId: () => 1 },
          result: overlayResult<ProductResult>(),
        }),
      ),
    );

    assertType<OverlayRef<ProductOverlayComponent, ProductResult>>(managerRef);

    fixture.destroy();
  });

  it('rejects unknown keys and wrong value types at compile time', () => {
    const inputs: OverlayInputs<ProductOverlayComponent> = {
      productId: () => 1,
      heading: () => 'title',
      compact: () => 'true',
      note: () => 'model inputs count',
    };

    const invalid: OverlayInputs<ProductOverlayComponent>[] = [
      // @ts-expect-error - misspelled input name
      { productID: () => 1 },
      // @ts-expect-error - wrong value type
      { productId: () => '1' },
      // @ts-expect-error - a plain signal is not an input
      { plain: () => 'x' },
    ];

    expect(Object.keys(inputs)).toHaveLength(4);
    expect(invalid).toHaveLength(3);

    TestBed.runInInjectionContext(() => {
      const manager = injectOverlayManager();

      // @ts-expect-error - misspelled input name on open()
      assertType(() => manager.open(ProductOverlayComponent, { inputs: { productID: () => 1 } }));
      // @ts-expect-error - wrong value type on open()
      assertType(() => manager.open(ProductOverlayComponent, { inputs: { productId: () => '1' } }));
    });
  });
});
