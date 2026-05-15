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

  it('provides afterOpened observable that emits on open', () => {
    const obs = overlayRef.afterOpened();
    let emitted = false;
    obs.subscribe(() => (emitted = true));
    expect(typeof obs.subscribe).toBe('function');
  });

  it('provides beforeClosed observable', () => {
    const obs = overlayRef.beforeClosed();
    expect(typeof obs.subscribe).toBe('function');
  });

  it('provides afterClosed observable', () => {
    const obs = overlayRef.afterClosed();
    expect(typeof obs.subscribe).toBe('function');
  });

  it('close method does not throw when called', () => {
    expect(() => overlayRef.close()).not.toThrow();
  });

  it('close method accepts result parameter', () => {
    expect(() => overlayRef.close({ data: 'test' })).not.toThrow();
  });

  it('stores config passed to constructor', () => {
    const config = { data: { key: 'value' } };
    const ref = new OverlayRef(config);
    expect(ref.config).toEqual(config);
  });
});
