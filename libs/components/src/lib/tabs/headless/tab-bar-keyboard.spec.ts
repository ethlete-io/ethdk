import { Component, signal } from '@angular/core';
import { mountControl } from '../../testing/control-driver';
import { createTabBarDriver } from '../testing/tabs-driver';
import { TabBarTriggerDirective } from './tab-bar-trigger.directive';
import { TabBarDirective } from './tab-bar.directive';
import { TAB_BAR_ORIENTATIONS, TabBarOrientation } from './tab-bar.types';

type TriggerConfig = { label: string; disabled?: boolean };

@Component({
  imports: [TabBarDirective, TabBarTriggerDirective],
  template: `
    <div [orientation]="orientation()" etTabBar>
      @for (t of triggers(); track t.label) {
        <button [disabled]="t.disabled ?? false" etTabBarTrigger type="button">{{ t.label }}</button>
      }
    </div>
    <button class="outside" type="button">Outside</button>
  `,
})
class TabBarKeyboardHostComponent {
  orientation = signal<TabBarOrientation>(TAB_BAR_ORIENTATIONS.HORIZONTAL);
  triggers = signal<TriggerConfig[]>([{ label: 'One' }, { label: 'Two' }, { label: 'Three' }]);
}

const mount = (triggers?: TriggerConfig[], orientation?: TabBarOrientation) => {
  const fixture = mountControl(TabBarKeyboardHostComponent);

  if (triggers) fixture.componentInstance.triggers.set(triggers);
  if (orientation) fixture.componentInstance.orientation.set(orientation);

  fixture.detectChanges();

  return createTabBarDriver(fixture);
};

describe('TabBarDirective keyboard model', () => {
  it('starts with the selected trigger as the roving tab stop', () => {
    const driver = mount();

    expect(driver.triggers().map((el) => el.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('moves the roving tab stop forward on ArrowRight without changing the selection', () => {
    const driver = mount();

    driver.focusTabbable();
    driver.press('ArrowRight');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(1));
    expect(driver.selectedIndex()).toBe(0);
  });

  it('wraps ArrowRight from the last trigger to the first', () => {
    const driver = mount();

    driver.focusTabbable();
    driver.press('ArrowRight');
    driver.press('ArrowRight');
    driver.press('ArrowRight');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(0));
  });

  it('wraps ArrowLeft from the first trigger to the last', () => {
    const driver = mount();

    driver.focusTabbable();
    driver.press('ArrowLeft');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(2));
  });

  it('skips disabled triggers when moving focus', () => {
    const driver = mount([{ label: 'One' }, { label: 'Two', disabled: true }, { label: 'Three' }]);

    driver.focusTabbable();
    driver.press('ArrowRight');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(2));
  });

  it('Home moves the tab stop to the first enabled trigger', () => {
    const driver = mount([
      { label: 'One', disabled: true },
      { label: 'Two' },
      { label: 'Three' },
      { label: 'Four', disabled: true },
    ]);

    driver.focusTabbable();
    driver.press('End');
    driver.press('Home');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(1));
  });

  it('End moves the tab stop to the last enabled trigger', () => {
    const driver = mount([
      { label: 'One', disabled: true },
      { label: 'Two' },
      { label: 'Three' },
      { label: 'Four', disabled: true },
    ]);

    driver.focusTabbable();
    driver.press('End');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(2));
  });

  it('uses ArrowDown/ArrowUp instead of ArrowRight/ArrowLeft when vertical', () => {
    const driver = mount(undefined, TAB_BAR_ORIENTATIONS.VERTICAL);

    driver.focusTabbable();
    driver.press('ArrowRight');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(0));

    driver.press('ArrowDown');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(1));

    driver.press('ArrowUp');

    expect(driver.tabbableTrigger()).toBe(driver.trigger(0));
  });

  it('Enter activates the focused trigger', () => {
    const driver = mount();

    driver.focusTabbable();
    driver.press('ArrowRight');
    driver.press('Enter');

    expect(driver.selectedIndex()).toBe(1);
  });

  it('does nothing on Enter before any arrow-key navigation moved focus', () => {
    const driver = mount();

    driver.focusTabbable();
    driver.press('Enter');

    expect(driver.selectedIndex()).toBe(0);
  });

  it('returns the roving tab stop to the selected trigger once focus leaves the bar', () => {
    const driver = mount();

    driver.focusTabbable();
    driver.press('ArrowRight');

    const focused = driver.tabbableTrigger()!;
    const outside = driver.query<HTMLButtonElement>('button.outside')!;

    expect(outside).not.toBeNull();

    focused.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    driver.tick();

    expect(driver.tabbableTrigger()).toBe(driver.trigger(0));
  });
});
