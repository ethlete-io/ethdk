import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayConfig } from '../overlay/overlay-config';
import { mergeOverlayConfigs } from '../overlay/overlay-config-merger';
import { OverlayManager, injectOverlayManager } from '../overlay/overlay-manager';
import {
  directiveAt,
  flushFrames,
  hostDirective,
  latestPane,
  pointerDownOutside,
  pointerEvent,
  pressKey,
  resetOverlays,
  textOf,
  tick,
} from './driver-core';
import { FakeMatchMedia } from './fake-match-media';

export type OverlayDriverOptions = {
  /** The config every `open()` starts from; a per-call config is merged on top of it. */
  config?: OverlayConfig;
  /**
   * The `fakeMatchMedia()` `switchBreakpoint` drives. Install it before the first inject that reads
   * a media query - creating this driver does not inject, but opening an overlay does.
   */
  breakpoints?: FakeMatchMedia;
};

/**
 * Drives a plain overlay - a dialog, a sheet, an opener or the overlay router - through the real
 * runtime, whose pane and backdrop live in the document instead of in the fixture. `open()` and
 * `openVia()` settle the enter transition out, so the overlay is dismissable the way a user would
 * dismiss it; the dismissal helpers settle the leave transition out in turn.
 *
 * A form control backed by an overlay is `createOverlayControlDriver`'s job instead.
 */
export const createOverlayDriver = <T>(
  fixture: ComponentFixture<T> | null = null,
  options: OverlayDriverOptions = {},
) => {
  const { config: baseConfig, breakpoints } = options;

  let overlayManager: OverlayManager | null = null;

  const manager = () => (overlayManager ??= TestBed.runInInjectionContext(() => injectOverlayManager()));

  const settle = async () => {
    await flushFrames();
    tick();
  };

  // The runtime arms Escape and outside-pointer closes one frame after the enter transition ends -
  // without the second settle every interactive dismissal after an open is silently ignored.
  const settleOpen = async () => {
    await settle();
    await settle();
  };

  const pane = () => latestPane();
  const paneEl = <E extends HTMLElement = HTMLElement>(selector: string) => pane()?.querySelector<E>(selector) ?? null;
  const paneEls = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(pane()?.querySelectorAll<E>(selector) ?? []);

  const backdrop = () =>
    Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-backdrop')).at(-1) ?? null;

  return {
    fixture,
    tick,
    settle,
    manager,

    open: async <C extends object, R = unknown>(component: Type<C>, config?: OverlayConfig) => {
      const overlayRef = TestBed.runInInjectionContext(() =>
        manager().open<C, R>(component, mergeOverlayConfigs(baseConfig, config)),
      );

      tick();
      await settleOpen();

      return overlayRef;
    },
    /** Opens through whatever the consumer already has - an opener, a trigger click, a navigation. */
    openVia: async <R>(act: () => R) => {
      const result = await act();

      tick();
      await settleOpen();

      return result;
    },
    openOverlays: () => manager().openOverlays(),

    pane,
    paneEl,
    paneEls,
    paneText: (selector: string) => textOf(paneEl(selector)),
    backdrop,

    query: <E extends HTMLElement = HTMLElement>(selector: string) =>
      (fixture?.nativeElement as HTMLElement | undefined)?.querySelector<E>(selector) ?? null,
    directive: <X>(type: Type<X>, selector?: string) => {
      if (!fixture) {
        throw new Error('[createOverlayDriver] directive() needs a fixture.');
      }

      return selector ? directiveAt(fixture, type, selector) : hostDirective(fixture, type);
    },

    escape: async () => {
      pressKey(document, 'Escape');
      await settle();
    },
    pointerDownOutside: async () => {
      pointerDownOutside();
      await settle();
    },
    clickBackdrop: async () => {
      const element = backdrop();

      if (!element) {
        throw new Error('[createOverlayDriver] no backdrop is rendered.');
      }

      pointerEvent(element, 'pointerdown');
      await settle();
    },
    // jsdom fires no transition events, so a leaving pane would linger and shadow the next open
    closeAll: () => {
      for (const overlayRef of manager().openOverlays()) {
        overlayRef.close();
      }

      tick();
      resetOverlays();
      tick();
    },

    switchBreakpoint: (width: number) => {
      if (!breakpoints) {
        throw new Error('[createOverlayDriver] switchBreakpoint() needs a `breakpoints` fakeMatchMedia().');
      }

      breakpoints.setViewportWidth(width);
      tick();
    },
  };
};
