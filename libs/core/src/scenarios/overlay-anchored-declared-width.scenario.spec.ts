import { Component } from '@angular/core';
import { anchoredOverlayPosition, AnimatedLifecycleDirective, injectOverlayRuntime } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-anchored-width',
  template: 'content',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioAnchoredWidthComponent {}

describe('anchored overlay with a declared width', () => {
  const scenario = useScenario();

  it('keeps the width the pane declares through --et-overlay-width after positioning', async () => {
    const s = scenario();
    const reference = document.createElement('button');
    document.body.appendChild(reference);

    const ref = s.run(() =>
      injectOverlayRuntime().mount({
        id: 'anchored-width',
        component: ScenarioAnchoredWidthComponent,
        autoFocus: false,
        modal: false,
        hasBackdrop: false,
        positionStrategy: anchoredOverlayPosition({ referenceElement: reference }),
      }),
    );
    const pane = ref.elements.paneElement;

    pane.style.setProperty('--et-overlay-width', '420px');
    await s.settle();
    s.flush();
    await s.settle();

    expect(ref.state()).toBe('mounted');
    expect(pane.style.width).toBe('420px');

    ref.close();
    s.flush();
    reference.remove();
  });
});
