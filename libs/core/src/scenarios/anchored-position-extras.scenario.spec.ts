import { enableAnchoredOverlayPositionExtras, hasAnchoredOverlayPositionExtras } from '../index';
import { useScenario } from './harness';

describe('scenario: anchored overlay position extras', () => {
  useScenario();

  it('reports whether the extras are registered', () => {
    expect(hasAnchoredOverlayPositionExtras()).toBe(false);

    enableAnchoredOverlayPositionExtras();

    expect(hasAnchoredOverlayPositionExtras()).toBe(true);
  });
});
