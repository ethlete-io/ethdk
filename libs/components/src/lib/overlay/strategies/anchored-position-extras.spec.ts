import { TestBed } from '@angular/core/testing';
import { enableAnchoredOverlayPositionExtras } from '@ethlete/core';
import { vi } from 'vitest';
import { injectAnchoredDialogStrategy } from './anchored-dialog.strategy';
import { buildAnchoredRuntimePositionStrategy } from './anchored.strategy';

vi.mock('@ethlete/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ethlete/core')>();

  return { ...actual, enableAnchoredOverlayPositionExtras: vi.fn(actual.enableAnchoredOverlayPositionExtras) };
});

describe('anchored position middleware extras', () => {
  beforeEach(() => vi.mocked(enableAnchoredOverlayPositionExtras).mockClear());

  it('are not installed by a bare anchored position strategy', () => {
    const origin = document.createElement('button');

    buildAnchoredRuntimePositionStrategy({ autoResize: true })(origin);

    expect(enableAnchoredOverlayPositionExtras).not.toHaveBeenCalled();
  });

  it('are installed when the anchored dialog strategy is built', () => {
    TestBed.runInInjectionContext(() => injectAnchoredDialogStrategy().build());

    expect(enableAnchoredOverlayPositionExtras).toHaveBeenCalled();
  });
});
