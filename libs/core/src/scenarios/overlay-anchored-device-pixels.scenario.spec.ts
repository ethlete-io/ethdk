import { Component } from '@angular/core';
import { anchoredOverlayPosition, AnimatedLifecycleDirective, injectOverlayRuntime } from '../index';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-anchored-pixels',
  template: 'content',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioAnchoredPixelsComponent {}

const openAtFractionalReference = async (s: Scenario) => {
  const reference = document.createElement('button');

  reference.getBoundingClientRect = () => new DOMRect(100.3, 116.6, 20, 10);
  document.body.appendChild(reference);

  const ref = s.run(() =>
    injectOverlayRuntime().mount({
      id: 'anchored-pixels',
      component: ScenarioAnchoredPixelsComponent,
      autoFocus: false,
      modal: false,
      hasBackdrop: false,
      positionStrategy: anchoredOverlayPosition({ referenceElement: reference, placement: 'bottom-start' }),
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
});
