import { Component } from '@angular/core';
import { AnimatedLifecycleDirective, injectOverlayRuntime } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-container-dialog',
  template: `<p>Text only</p>`,
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioContainerDialogComponent {}

describe('overlay container autofocus scenarios', () => {
  const scenario = useScenario();

  it('B524 moves focus off the trigger onto the dialog for autoFocus container', () => {
    const s = scenario();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const dialog = s.run(() =>
      injectOverlayRuntime().mount({
        id: 'container-dialog',
        component: ScenarioContainerDialogComponent,
        role: 'dialog',
        autoFocus: 'container',
      }),
    );
    s.flush();

    expect(document.activeElement).toBe(dialog.elements.hostElement);

    dialog.close();
    s.flush();
    trigger.remove();
  });
});
