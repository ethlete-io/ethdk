import { Component } from '@angular/core';
import { Placement } from '@floating-ui/dom';
import {
  anchoredOverlayPosition,
  AnimatedLifecycleDirective,
  enableAnchoredOverlayPositionExtras,
  injectOverlayRuntime,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-anchored-pixels',
  template: 'content',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioAnchoredPixelsComponent {}

@Component({
  selector: 'et-scenario-anchored-pixels-arrow',
  template: 'content<span et-floating-arrow></span>',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioAnchoredPixelsArrowComponent {}

type OpenOptions = {
  referenceX?: number;
  referenceWidth?: number;
  viewportPadding?: number;
  placement?: Placement;
  withArrow?: boolean;
};

const openAtFractionalReference = async (
  s: Scenario,
  { referenceX = 100.3, referenceWidth = 20, viewportPadding, placement = 'bottom-start', withArrow }: OpenOptions = {},
) => {
  const reference = document.createElement('button');

  reference.getBoundingClientRect = () => new DOMRect(referenceX, 116.6, referenceWidth, 10);
  document.body.appendChild(reference);

  const ref = s.run(() =>
    injectOverlayRuntime().mount({
      id: 'anchored-pixels',
      component: withArrow ? ScenarioAnchoredPixelsArrowComponent : ScenarioAnchoredPixelsComponent,
      autoFocus: false,
      modal: false,
      hasBackdrop: false,
      positionStrategy: anchoredOverlayPosition({
        referenceElement: reference,
        placement,
        viewportPadding,
      }),
    }),
  );

  await s.settle();
  s.flush();
  await s.settle();

  return { ref, reference };
};

describe('anchored overlay at a fractional reference position', () => {
  const scenario = useScenario();

  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    { ratio: 1, x: '100px', y: '135px' },
    { ratio: 2, x: '100.5px', y: '134.5px' },
  ])('snaps the pane offset to whole device pixels at a ratio of $ratio', async ({ ratio, x, y }) => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(ratio);

    const s = scenario();
    const { ref, reference } = await openAtFractionalReference(s);
    const pane = ref.elements.paneElement;

    expect(pane.style.transform).toBe(`translate3d(${x}, ${y}, 0)`);
    expect(pane.style.getPropertyValue('--et-overlay-anchored-x')).toBe(x);
    expect(pane.style.getPropertyValue('--et-overlay-anchored-y')).toBe(y);

    ref.close();
    s.flush();
    reference.remove();
  });

  it('keeps a shifted pane inside the viewport padding when rounding', async () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2.625);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(351);

    const s = scenario();
    const { ref, reference } = await openAtFractionalReference(s, { referenceX: 0, viewportPadding: 8.4 });
    const x = parseFloat(ref.elements.paneElement.style.getPropertyValue('--et-overlay-anchored-x'));

    expect(x).toBeGreaterThanOrEqual(8.4);

    ref.close();
    s.flush();
    reference.remove();
  });

  it.each([
    { ratio: 1, x: 610.375 },
    { ratio: 2, x: 610.375 },
  ])(
    'keeps the reference edge of an end-aligned pane of fractional width at a ratio of $ratio',
    async ({ ratio, x }) => {
      vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(ratio);
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(190);
      const computedStyle = window.getComputedStyle.bind(window);

      vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
        const style = computedStyle(element, pseudo);

        if (!element.classList.contains('et-overlay-runtime-pane')) return style;

        return new Proxy(style, {
          get: (target, key) => (key === 'width' ? '189.625px' : Reflect.get(target, key)),
        });
      });

      const s = scenario();
      const { ref, reference } = await openAtFractionalReference(s, { referenceX: 780, placement: 'bottom-end' });
      const pane = ref.elements.paneElement;
      const paneX = parseFloat(pane.style.getPropertyValue('--et-overlay-anchored-x'));

      expect(paneX).toBe(x);
      expect(paneX + 189.625).toBe(800);

      ref.close();
      s.flush();
      reference.remove();
    },
  );

  it('keeps the arrow on the reference centre when rounding moves the pane', async () => {
    enableAnchoredOverlayPositionExtras();
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('et-floating-arrow') ? 20 : 190;
    });
    const computedStyle = window.getComputedStyle.bind(window);

    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = computedStyle(element, pseudo);
      const width = element.classList.contains('et-overlay-runtime-pane')
        ? '189.625px'
        : element.hasAttribute('et-floating-arrow')
          ? '20px'
          : undefined;

      if (!width) return style;

      return new Proxy(style, { get: (target, key) => (key === 'width' ? width : Reflect.get(target, key)) });
    });

    const s = scenario();
    const { ref, reference } = await openAtFractionalReference(s, {
      referenceX: 699.8125,
      referenceWidth: 100,
      placement: 'bottom-end',
      withArrow: true,
    });
    const pane = ref.elements.paneElement;
    const paneX = parseFloat(pane.style.getPropertyValue('--et-overlay-anchored-x'));
    const arrow = pane.querySelector<HTMLElement>('[et-floating-arrow]')!;
    const arrowX = parseFloat(
      arrow.style.getPropertyValue('--et-floating-arrow-translate').slice('translate3d('.length),
    );

    expect(paneX).toBe(610.375);
    expect(paneX + arrowX + 10).toBe(749.8125);

    ref.close();
    s.flush();
    reference.remove();
  });
});
