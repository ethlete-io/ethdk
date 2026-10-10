import { Component } from '@angular/core';
import {
  anchoredOverlayPosition,
  DEFAULT_OVERLAY_LAYER,
  injectOverlayRuntime,
  OverlayRuntimeCloseEvent,
  OverlayRuntimeMountConfig,
  OverlayRuntimeRef,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({ selector: 'et-scenario-layered', template: '<button type="button">inside</button>' })
class ScenarioLayeredComponent {}

const open = (s: Scenario, config: Partial<OverlayRuntimeMountConfig<ScenarioLayeredComponent>> = {}) => {
  const ref = s.run(() =>
    injectOverlayRuntime().mount({
      id: 'layered',
      component: ScenarioLayeredComponent,
      autoFocus: false,
      ...config,
    }),
  );

  s.flush();
  expect(ref.state()).toBe('mounted');

  return ref;
};

const closeSources = (ref: OverlayRuntimeRef) => {
  const sources: OverlayRuntimeCloseEvent['source'][] = [];

  ref.afterClosed().subscribe((event) => sources.push(event.source));

  return sources;
};

const roots = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-root')).map((root) => root.style.zIndex);

const press = (target: Element) => target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

const click = (target: Element) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });

  target.dispatchEvent(event);

  return event;
};

const createOrigin = () => {
  const origin = document.createElement('button');

  origin.getBoundingClientRect = () => new DOMRect(100, 50, 40, 20);
  document.body.appendChild(origin);

  return origin;
};

describe('overlay layer scenarios', () => {
  const scenario = useScenario();

  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
  });

  afterEach(() => vi.restoreAllMocks());

  it('gives each layer its own root and removes each root with its last overlay', () => {
    const s = scenario();
    const low = open(s, { id: 'low', modal: false, hasBackdrop: false });
    const high = open(s, { id: 'high', zIndex: DEFAULT_OVERLAY_LAYER + 5, modal: false, hasBackdrop: false });
    const lowSources = closeSources(low);

    expect(roots()).toEqual([`${DEFAULT_OVERLAY_LAYER}`, `${DEFAULT_OVERLAY_LAYER + 5}`]);

    press(high.elements.paneElement.querySelector('button')!);
    expect(lowSources).toEqual([]);

    high.close();
    s.flush();

    expect(roots()).toEqual([`${DEFAULT_OVERLAY_LAYER}`]);
    expect(low.state()).toBe('mounted');

    press(document.body);
    s.flush();

    expect(lowSources).toEqual(['outside-pointer']);
    expect(roots()).toEqual([]);
  });

  it('answers Escape on the highest layer first, whatever order the layers opened in', () => {
    const s = scenario();
    const high = open(s, { id: 'high', zIndex: DEFAULT_OVERLAY_LAYER + 5 });
    const low = open(s, { id: 'low' });
    const highSources = closeSources(high);
    const lowSources = closeSources(low);

    s.keydown('Escape');
    s.flush();

    expect(highSources).toEqual(['escape']);
    expect(lowSources).toEqual([]);

    s.keydown('Escape');
    s.flush();

    expect(lowSources).toEqual(['escape']);
  });

  it('swallows only the click that ends the press which closed an anchored overlay', () => {
    const s = scenario();
    const origin = createOrigin();
    const ref = open(s, {
      modal: false,
      hasBackdrop: false,
      positionStrategy: anchoredOverlayPosition({ referenceElement: origin }),
    });
    const sources = closeSources(ref);

    press(origin);
    s.flush();

    expect(sources).toEqual(['outside-pointer']);

    origin.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    press(origin);

    expect(click(origin).defaultPrevented).toBe(false);

    origin.remove();
  });

  it('releases the document when the app goes away between the closing press and its click', () => {
    const s = scenario();
    const origin = createOrigin();
    const ref = open(s, {
      modal: false,
      hasBackdrop: false,
      positionStrategy: anchoredOverlayPosition({ referenceElement: origin }),
    });

    press(origin);
    s.flush();
    expect(ref.state()).toBe('closed');

    origin.remove();
  });
});
