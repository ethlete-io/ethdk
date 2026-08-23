import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver } from '../../testing/control-driver';
import { pressKey } from '../../testing/driver-core';
import { TabBarDirective } from '../headless/tab-bar.directive';

export type TabBarDriverOptions = ControlDriverOptions & {
  /** Matches every trigger inside the bar. Defaults to the role every `TabBarTriggerDirective` host carries. */
  triggerSelector?: string;
};

/**
 * Wraps a mounted `[etTabBar]` host with the roving-tabindex vocabulary its keyboard model needs:
 * which trigger is currently the tab stop, and dispatching a key from wherever focus actually is.
 */
export const createTabBarDriver = <T>(fixture: ComponentFixture<T>, options: TabBarDriverOptions = {}) => {
  const { triggerSelector = '[role="tab"]', ...controlOptions } = options;
  const base = createControlDriver(fixture, TabBarDirective, controlOptions);

  const triggers = () => base.queryAll<HTMLButtonElement>(triggerSelector);

  const trigger = (index: number) => {
    const el = triggers()[index];

    if (!el) throw new Error(`No tab trigger at index ${index}`);

    return el;
  };

  /** The trigger the roving-tabindex model made the tab stop - `tabindex="0"` among the bar's triggers. */
  const tabbableTrigger = () => triggers().find((el) => el.getAttribute('tabindex') === '0') ?? null;

  const focusTabbable = () => {
    const el = tabbableTrigger();

    if (!el) throw new Error('No tabbable trigger - the roving-tabindex lookup found nothing');

    el.focus();
    base.tick();
  };

  /** Dispatches `key` from wherever focus currently is, falling back to the roving tab stop. */
  const press = (key: string, init?: KeyboardEventInit) => {
    const target = (document.activeElement as HTMLElement | null) ?? tabbableTrigger();

    if (!target) throw new Error('No focused trigger to dispatch the keydown on');

    pressKey(target, key, init);
  };

  return {
    ...base,
    triggers,
    trigger,
    tabbableTrigger,
    focusTabbable,
    press,
    focusedIndex: () => base.control.focusedIndex(),
    selectedIndex: () => base.control.selectedIndex(),
  };
};
