import { Injector, inputBinding } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import '../../test-helpers';
import { createOverlayRef } from './overlay-ref-internal';

describe('createOverlayRef', () => {
  it('initializes with empty id', () => {
    const { ref } = createOverlayRef({});
    expect(ref.id).toBe('');
  });

  it('initializes with null componentInstance', () => {
    const { ref } = createOverlayRef({});
    expect(ref.componentInstance()).toBeNull();
  });

  it('stores config', () => {
    const config = { bindings: [inputBinding('key', () => 'value')] };
    const { ref } = createOverlayRef(config);
    expect(ref.config).toEqual(config);
  });

  it('starts not busy', () => {
    const { ref } = createOverlayRef({});
    expect(ref.busy()).toBe(false);
  });

  it('completes afterOpened when the overlay closes before it opened', () => {
    const { ref, internals } = createOverlayRef({});
    const afterOpened = new Subject<void>();
    const afterClosed = new Subject<object>();
    const never = new Subject<never>();
    const complete = vi.fn();

    ref.afterOpened().subscribe({ complete });

    internals.attachRuntime(
      {
        id: 'x',
        elements: { paneElement: document.createElement('div') },
        registerCloseGuard: () => () => undefined,
        afterOpened: () => afterOpened,
        beforeClosed: () => never,
        afterClosed: () => afterClosed,
      } as never,
      TestBed.inject(Injector),
    );

    afterClosed.next({ result: undefined });
    afterClosed.complete();

    expect(complete).toHaveBeenCalledTimes(1);
  });
});
