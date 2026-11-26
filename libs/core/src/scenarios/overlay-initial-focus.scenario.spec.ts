import { Component } from '@angular/core';
import { AnimatedLifecycleDirective, injectOverlayRuntime } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-initial-focus-overlay',
  template: '<button class="scenario-first" type="button">first</button><input class="scenario-field" />',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioInitialFocusOverlayComponent {}

describe('overlay initial focus scenarios', () => {
  const scenario = useScenario();

  it('keeps focus on a field the user focused while the overlay was still entering', () => {
    const s = scenario();
    const overlay = s.run(() =>
      injectOverlayRuntime().mount({
        id: 'entering',
        component: ScenarioInitialFocusOverlayComponent,
        autoFocus: '.scenario-first',
      }),
    );

    s.frame(1);
    const field = overlay.elements.paneElement.querySelector<HTMLInputElement>('.scenario-field');
    field?.focus();
    s.flush();

    expect(document.activeElement).toBe(field);

    overlay.close();
    s.flush();
  });

  it('still moves focus into the pane when nothing inside it is focused', () => {
    const s = scenario();
    const overlay = s.run(() =>
      injectOverlayRuntime().mount({
        id: 'idle',
        component: ScenarioInitialFocusOverlayComponent,
        autoFocus: '.scenario-first',
      }),
    );

    s.flush();

    expect(document.activeElement).toBe(overlay.elements.paneElement.querySelector('.scenario-first'));

    overlay.close();
    s.flush();
  });
});
