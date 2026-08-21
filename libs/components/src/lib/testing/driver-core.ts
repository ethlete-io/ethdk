import { ApplicationRef, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

export const tick = () => TestBed.inject(ApplicationRef).tick();

export const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export const resetOverlays = () =>
  document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

/**
 * The newest overlay pane in the document.
 *
 * Overlays render into the document, not into the fixture, and jsdom fires no transition events -
 * so a pane stuck in its leave transition stays reachable. Scope every pane query through here, or
 * a stale pane answers it.
 */
export const latestPane = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;

export const hostDirective = <T>(fixture: ComponentFixture<unknown>, type: Type<T>) =>
  fixture.debugElement.children[0]!.injector.get(type);

export const hostElement = (fixture: ComponentFixture<unknown>) =>
  fixture.debugElement.children[0]!.nativeElement as HTMLElement;

export const pressKey = (target: EventTarget, key: string) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  tick();
};

export const focusEvent = (target: EventTarget, type: 'focus' | 'blur') => {
  target.dispatchEvent(new FocusEvent(type));
  tick();
};

export const pointerEnter = (target: EventTarget) => {
  target.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
  tick();
};

export const setInputValue = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  tick();
};

/** jsdom has no `DataTransfer`, so the clipboard payload is faked onto the event. */
export const pasteInto = (target: EventTarget, text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  target.dispatchEvent(event);
  tick();
};

export const textOf = (element: Element | null | undefined) => element?.textContent?.trim() ?? null;
