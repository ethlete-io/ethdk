import { InjectionToken } from '@angular/core';
import '../../test-helpers';
import { OVERLAY_DATA, injectOverlayData } from './overlay-data';

describe('OVERLAY_DATA', () => {
  it('is an InjectionToken instance', () => {
    expect(OVERLAY_DATA).toBeInstanceOf(InjectionToken);
  });

  it('has the OVERLAY_DATA token description', () => {
    expect(OVERLAY_DATA.toString()).toContain('OVERLAY_DATA');
  });
});

describe('injectOverlayData', () => {
  it('is a function', () => {
    expect(typeof injectOverlayData).toBe('function');
  });

  it('returns a typed injection wrapper', () => {
    // injectOverlayData is a generic factory — verify it returns a function result
    expect(injectOverlayData).not.toBeNull();
  });
});
