import { Component } from '@angular/core';
import { AnimatedLifecycleDirective, injectOverlayRuntime } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-radio-dialog',
  template: `
    <button class="scenario-radio-dialog-button" type="button">Save</button>
    <input name="size" type="radio" value="s" />
    <input name="size" checked type="radio" value="m" />
    <input name="size" type="radio" value="l" />
  `,
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioRadioDialogComponent {}

describe('hunt overlay fix scenarios', () => {
  const scenario = useScenario();

  it('HO-04 keeps Tab inside a modal whose last control is a native radio group', () => {
    const s = scenario();
    const rectsSpy = vi
      .spyOn(Element.prototype, 'getClientRects')
      .mockReturnValue([{} as DOMRect] as unknown as DOMRectList);

    const dialog = s.run(() =>
      injectOverlayRuntime().mount({ id: 'radio-dialog', component: ScenarioRadioDialogComponent, autoFocus: false }),
    );
    s.flush();

    const pane = dialog.elements.paneElement;
    const button = pane.querySelector<HTMLButtonElement>('.scenario-radio-dialog-button');
    const checkedRadio = pane.querySelector<HTMLInputElement>('input[value="m"]');
    const pressTab = (target: HTMLElement | null, shiftKey = false) => {
      target?.focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      target?.dispatchEvent(event);

      return event.defaultPrevented;
    };

    expect(pressTab(checkedRadio)).toBe(true);
    expect(document.activeElement).toBe(button);

    expect(pressTab(button, true)).toBe(true);
    expect(document.activeElement).toBe(checkedRadio);

    dialog.close();
    s.flush();
    rectsSpy.mockRestore();
  });
});
