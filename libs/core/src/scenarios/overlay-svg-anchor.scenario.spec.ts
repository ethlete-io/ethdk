import { Component } from '@angular/core';
import {
  anchoredOverlayPosition,
  AnimatedLifecycleDirective,
  enableAnchoredOverlayPositionExtras,
  injectOverlayRuntime,
  OverlayRuntimeCloseEvent,
  OverlayRuntimeMountConfig,
  OverlayRuntimeRef,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-svg-anchored',
  template: '<button type="button">inside</button>',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioAnchoredComponent {}

const SVG_NS = 'http://www.w3.org/2000/svg';

const createRect = () => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const rect = document.createElementNS(SVG_NS, 'rect');

  rect.setAttribute('tabindex', '0');
  rect.getBoundingClientRect = () => new DOMRect(100, 50, 20, 10);
  svg.appendChild(rect);
  document.body.appendChild(svg);

  return { svg, rect };
};

const closedSources = (ref: OverlayRuntimeRef) => {
  const closed: OverlayRuntimeCloseEvent<unknown>[] = [];

  ref.afterClosed().subscribe((event) => closed.push(event));

  return closed;
};

const mountAnchored = async (
  s: Scenario,
  rect: SVGRectElement,
  config: Partial<OverlayRuntimeMountConfig<ScenarioAnchoredComponent>> = {},
) => {
  const ref = s.run(() => {
    enableAnchoredOverlayPositionExtras();

    return injectOverlayRuntime().mount({
      id: 'svg-anchored',
      component: ScenarioAnchoredComponent,
      autoFocus: false,
      modal: false,
      hasBackdrop: false,
      positionStrategy: anchoredOverlayPosition({ referenceElement: rect, placement: 'bottom-start' }),
      ...config,
    });
  });

  await s.settle();
  s.flush();
  await s.settle();
  expect(ref.state()).toBe('mounted');

  return ref;
};

describe('overlay anchored to an svg element', () => {
  const scenario = useScenario();

  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
  });

  afterEach(() => vi.restoreAllMocks());

  it('positions the pane against the svg element', async () => {
    const s = scenario();
    const { svg, rect } = createRect();
    const ref = await mountAnchored(s, rect);

    expect(ref.elements.paneElement.style.transform).toBe('translate3d(100px, 68px, 0)');

    ref.close();
    s.flush();
    svg.remove();
  });

  it('closes as reference-detached when the svg element leaves the document', async () => {
    const s = scenario();
    const { svg, rect } = createRect();
    const ref = await mountAnchored(s, rect, {
      positionStrategy: anchoredOverlayPosition({ referenceElement: rect, autoCloseIfReferenceHidden: true }),
    });
    const closed = closedSources(ref);

    svg.remove();
    window.dispatchEvent(new Event('resize'));
    await s.settle();
    s.flush();

    expect(ref.state()).toBe('closed');
    expect(closed.map((event) => event.source)).toEqual(['reference-detached']);
  });

  it('treats a press on the svg origin as a toggle-close and swallows the reopening click', async () => {
    const s = scenario();
    const { svg, rect } = createRect();
    const ref = await mountAnchored(s, rect, { closeOnOutsidePointer: true });
    const closed = closedSources(ref);

    rect.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    rect.dispatchEvent(click);
    s.flush();

    expect(closed.map((event) => event.source)).toEqual(['outside-pointer']);
    expect(click.defaultPrevented).toBe(true);

    svg.remove();
  });

  it('returns focus to the focused svg element on close', async () => {
    const s = scenario();
    const { svg, rect } = createRect();

    rect.focus();
    expect(document.activeElement).toBe(rect);

    const ref = await mountAnchored(s, rect);
    const inside = ref.elements.paneElement.querySelector('button');

    inside?.focus();
    expect(document.activeElement).toBe(inside);

    ref.close();
    s.flush();

    expect(document.activeElement).toBe(rect);

    svg.remove();
  });
});
