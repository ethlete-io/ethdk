import { Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver } from './control-driver';
import { flushFrames, latestPane, pointerDownOutside, pressKey, resetOverlays, tick } from './driver-core';

export { mountControl } from './control-driver';

export type OverlayControlDriverOptions<D> = ControlDriverOptions & {
  /** The element the user clicks to open the overlay. */
  triggerSelector?: string;
  /** How this control closes its overlay from code. */
  hide: (control: D) => void;
};

/**
 * The plumbing every overlay-backed form control driver needs: the host component, the directive,
 * the trigger, the overlay pane, and the open/close dance jsdom needs two frames for.
 */
export const createOverlayControlDriver = <T, D>(
  fixture: ComponentFixture<T>,
  directiveType: Type<D>,
  { triggerSelector = '[role="combobox"]', hide, ...controlOptions }: OverlayControlDriverOptions<D>,
) => {
  const base = createControlDriver(fixture, directiveType, controlOptions);

  const pane = () => latestPane();
  const paneEl = <E extends HTMLElement = HTMLElement>(selector: string) => pane()?.querySelector<E>(selector) ?? null;
  const paneEls = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(pane()?.querySelectorAll<E>(selector) ?? []);

  const trigger = <E extends HTMLElement = HTMLElement>() => base.query<E>(triggerSelector)!;

  const settle = async () => {
    await flushFrames();
    tick();
  };

  return {
    ...base,
    settle,
    trigger,

    pane,
    paneEl,
    paneEls,

    open: async () => {
      trigger().click();
      tick();
      await settle();
    },
    close: async () => {
      hide(base.control);
      tick();
      await settle();
    },
    // jsdom fires no transition events, so a leaving pane would linger and shadow the next open
    closeAndRemovePanes: () => {
      hide(base.control);
      tick();
      resetOverlays();
      tick();
    },
    press: (key: string) => pressKey(trigger(), key),
    escape: () => pressKey(document, 'Escape'),
    pointerDownOutside,
    clickInPane: (selector: string) => {
      paneEl(selector)!.click();
      tick();
    },
  };
};
