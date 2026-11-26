import { Component } from '@angular/core';
import { AnimatedLifecycleDirective, injectOverlayRuntime } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-focus-overlay',
  template: '<button class="scenario-focus-item" type="button">item</button>',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioFocusOverlayComponent {}

describe('overlay focus restore scenarios', () => {
  const scenario = useScenario();

  it('returns focus to the menu trigger when a dialog opened from a since-closed menu closes', () => {
    const s = scenario();
    const trigger = document.createElement('button');

    document.body.appendChild(trigger);
    trigger.focus();

    const mount = (id: string) =>
      s.run(() => injectOverlayRuntime().mount({ id, component: ScenarioFocusOverlayComponent, autoFocus: false }));

    const menu = mount('menu');
    s.flush();

    const item = menu.elements.paneElement.querySelector<HTMLButtonElement>('.scenario-focus-item');
    item?.focus();

    const dialog = mount('dialog');
    menu.close();
    s.flush();
    dialog.elements.paneElement.querySelector<HTMLButtonElement>('.scenario-focus-item')?.focus();

    expect(item?.isConnected).toBe(false);

    dialog.close();
    s.flush();

    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
