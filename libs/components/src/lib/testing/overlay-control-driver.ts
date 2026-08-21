import { Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { TEST_COLOR_THEMES } from './color-themes';
import {
  flushFrames,
  hostDirective,
  hostElement,
  latestPane,
  pointerDownOutside,
  pressKey,
  resetOverlays,
  tick,
} from './driver-core';

export const mountControl = <T>(component: Type<T>, providers: Provider[] = []) => {
  resetOverlays();

  TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES), ...providers] });

  const fixture = TestBed.createComponent(component);

  fixture.detectChanges();

  return fixture;
};

export type OverlayControlDriverOptions<D> = {
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
  { triggerSelector = '[role="combobox"]', hide }: OverlayControlDriverOptions<D>,
) => {
  const control = hostDirective(fixture, directiveType);
  const root = fixture.nativeElement as HTMLElement;

  const query = <E extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<E>(selector);
  const queryAll = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(root.querySelectorAll<E>(selector));

  const pane = () => latestPane();
  const paneEl = <E extends HTMLElement = HTMLElement>(selector: string) => pane()?.querySelector<E>(selector) ?? null;
  const paneEls = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(pane()?.querySelectorAll<E>(selector) ?? []);

  const trigger = <E extends HTMLElement = HTMLElement>() => query<E>(triggerSelector)!;

  const settle = async () => {
    await flushFrames();
    tick();
  };

  return {
    fixture,
    host: fixture.componentInstance,
    control,
    detectChanges: () => fixture.detectChanges(),
    settle,

    element: () => hostElement(fixture),
    query,
    queryAll,
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
      hide(control);
      tick();
      await settle();
    },
    // jsdom fires no transition events, so a leaving pane would linger and shadow the next open
    closeAndRemovePanes: () => {
      hide(control);
      tick();
      resetOverlays();
      tick();
    },
    press: (key: string) => pressKey(trigger(), key),
    escape: () => pressKey(document, 'Escape'),
    pointerDownOutside,
    click: (element: HTMLElement) => {
      element.click();
      tick();
    },
    clickInPane: (selector: string) => {
      paneEl(selector)!.click();
      tick();
    },
  };
};
