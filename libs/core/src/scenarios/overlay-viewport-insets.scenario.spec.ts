import { Component } from '@angular/core';
import {
  DEFAULT_OVERLAY_LAYER,
  injectOverlayRuntime,
  OverlayRuntimeMountConfig,
  reserveOverlayViewportSpace,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({ selector: 'et-scenario-inset-dialog', template: '<p>content</p>' })
class ScenarioInsetDialogComponent {}

const open = (s: Scenario, config: Partial<OverlayRuntimeMountConfig<ScenarioInsetDialogComponent>> = {}) => {
  const ref = s.run(() =>
    injectOverlayRuntime().mount({
      id: 'inset-dialog',
      component: ScenarioInsetDialogComponent,
      autoFocus: false,
      ...config,
    }),
  );

  s.flush();
  expect(ref.state()).toBe('mounted');

  return ref;
};

const hostInsets = (host: HTMLElement) => [host.style.top, host.style.right, host.style.bottom, host.style.left];

const publishedBottom = () => document.documentElement.style.getPropertyValue('--et-viewport-inset-bottom');

describe('overlay viewport inset scenarios', () => {
  const scenario = useScenario();

  it('lays a centered overlay out around a reservation made before and after it opened', () => {
    const s = scenario();
    const releaseBottom = reserveOverlayViewportSpace({ bottom: 120 });
    const ref = open(s);
    const host = ref.elements.hostElement;

    expect(hostInsets(host)).toEqual(['0px', '0px', '120px', '0px']);

    const releaseRight = reserveOverlayViewportSpace({ right: 300, bottom: 40 });

    expect(hostInsets(host)).toEqual(['0px', '300px', '120px', '0px']);
    expect(publishedBottom()).toBe('120px');

    releaseBottom();

    expect(hostInsets(host)).toEqual(['0px', '300px', '40px', '0px']);

    releaseRight();
    releaseRight();

    expect(hostInsets(host)).toEqual(['0px', '0px', '0px', '0px']);
    expect(publishedBottom()).toBe('');

    ref.close();
    s.flush();
  });

  it('stops following reservations once the overlay is closed', () => {
    const s = scenario();
    const ref = open(s, { positionStrategy: { kind: 'global', vertical: 'end' } });
    const host = ref.elements.hostElement;

    ref.close();
    s.flush();
    expect(ref.state()).toBe('closed');

    const release = reserveOverlayViewportSpace({ top: 80 });

    expect(host.style.top).toBe('0px');

    release();
  });

  it('ignores a reservation made on or below the layer the overlay mounts at', () => {
    const s = scenario();
    const release = reserveOverlayViewportSpace({ left: 200, layer: DEFAULT_OVERLAY_LAYER + 10 });
    const below = open(s, { id: 'below' });
    const above = open(s, { id: 'above', zIndex: DEFAULT_OVERLAY_LAYER + 10 });

    expect(below.elements.hostElement.style.left).toBe('200px');
    expect(above.elements.hostElement.style.left).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--et-viewport-inset-left')).toBe('200px');

    release();

    expect(below.elements.hostElement.style.left).toBe('0px');

    above.close();
    below.close();
    s.flush();
  });

  it('keeps out of a reservation after the position strategy switches', () => {
    const s = scenario();
    const release = reserveOverlayViewportSpace({ top: 64 });
    const ref = open(s);
    const host = ref.elements.hostElement;

    ref.updatePositionStrategy({ kind: 'global', vertical: 'start', horizontal: 'end' });

    expect(host.style.top).toBe('64px');
    expect(host.style.placeItems).toBe('start end');

    release();

    expect(host.style.top).toBe('0px');

    ref.close();
    s.flush();
  });
});
