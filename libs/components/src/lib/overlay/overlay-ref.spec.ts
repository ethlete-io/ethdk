import '../../test-helpers';
import { OverlayRef } from './overlay-ref';

describe('OverlayRef', () => {
  let overlayRef: OverlayRef;

  beforeEach(() => {
    overlayRef = new OverlayRef({});
  });

  it('initializes with empty id', () => {
    expect(overlayRef.id).toBe('');
  });

  it('initializes with null componentInstance', () => {
    expect(overlayRef.componentInstance).toBeNull();
  });

  it('initializes with null componentRef', () => {
    expect(overlayRef.componentRef).toBeNull();
  });

  it('stores config passed to constructor', () => {
    const config = { data: { key: 'value' } };
    const ref = new OverlayRef(config);
    expect(ref.config).toEqual(config);
  });
});
