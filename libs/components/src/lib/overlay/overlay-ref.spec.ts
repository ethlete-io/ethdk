import { inputBinding } from '@angular/core';
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
});
