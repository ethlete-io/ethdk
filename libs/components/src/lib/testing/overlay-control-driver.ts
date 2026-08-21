import { Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { TEST_COLOR_THEMES } from './color-themes';
import { flushFrames, hostDirective, hostElement, latestPane, pressKey, resetOverlays, tick } from './driver-core';

export const mountControl = <T>(component: Type<T>, providers: Provider[] = []) => {
  resetOverlays();

  TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES), ...providers] });

  const fixture = TestBed.createComponent(component);

  fixture.detectChanges();

  return fixture;
};

export type OverlayControlDriverOptions = {
  /** The element the user clicks to open the overlay. */
  triggerSelector?: string;
};

/**
 * The plumbing every overlay-backed form control driver needs: the host component, the directive,
 * the trigger, the overlay pane, and the open/close dance jsdom needs two frames for.
 */
export const createOverlayControlDriver = <T, D extends { hide: () => void }>(
  fixture: ComponentFixture<T>,
  directiveType: Type<D>,
  { triggerSelector = '[role="combobox"]' }: OverlayControlDriverOptions = {},
) => {
  const directive = hostDirective(fixture, directiveType);
  const root = fixture.nativeElement as HTMLElement;

  const query = <E extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<E>(selector);
  const queryAll = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(root.querySelectorAll<E>(selector));

  const pane = () => latestPane();
  const paneEl = <E extends HTMLElement = HTMLElement>(selector: string) => pane()?.querySelector<E>(selector) ?? null;
  const paneEls = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(pane()?.querySelectorAll<E>(selector) ?? []);

  const trigger = () => query(triggerSelector)!;

  const settle = async () => {
    await flushFrames();
    tick();
  };

  return {
    fixture,
    host: fixture.componentInstance,
    directive,
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
      directive.hide();
      tick();
      await settle();
    },
    press: (key: string) => pressKey(trigger(), key),
    escape: () => pressKey(document, 'Escape'),
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
