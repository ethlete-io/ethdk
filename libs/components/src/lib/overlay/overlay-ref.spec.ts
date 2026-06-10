import '../../test-helpers';
import { createOverlayRef } from './overlay-ref';

describe('createOverlayRef', () => {
  it('initializes with empty id', () => {
    const ref = createOverlayRef({});
    expect(ref.id).toBe('');
  });

  it('initializes with null componentInstance', () => {
    const ref = createOverlayRef({});
    expect(ref.componentInstance).toBeNull();
  });

  it('stores config', () => {
    const config = { data: { key: 'value' } };
    const ref = createOverlayRef(config);
    expect(ref.config).toEqual(config);
  });
});
