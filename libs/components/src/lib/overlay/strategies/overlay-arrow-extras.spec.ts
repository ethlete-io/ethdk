import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { enableAnchoredOverlayPositionExtras } from '@ethlete/core';
import '../../../test-helpers';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayStrategy } from './overlay-strategy.types';

@Component({ template: 'content' })
class ArrowContentComponent {}

const arrowStrategy: OverlayStrategy = {
  id: 'arrow',
  config: { arrow: true, positionStrategy: () => ({ kind: 'center' }) },
  onSwitchedTo: vi.fn(),
  onSwitchedAwayFrom: vi.fn(),
  onBeforeEnter: vi.fn(),
  onAfterEnter: vi.fn(),
  onBeforeLeave: vi.fn(),
  onAfterLeave: vi.fn(),
};

describe('overlay strategy arrow without position extras', () => {
  const open = () =>
    TestBed.runInInjectionContext(() =>
      injectOverlayManager().open(ArrowContentComponent, { strategies: () => [{ strategy: arrowStrategy }] }),
    );

  it('throws ET1212 in dev mode until the extras are enabled', () => {
    expect(open).toThrow(/enableAnchoredOverlayPositionExtras\(\)/);

    enableAnchoredOverlayPositionExtras();

    const ref = open();
    TestBed.tick();
    ref.close();
  });
});
