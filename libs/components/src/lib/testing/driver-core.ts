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

export const directiveAt = <T>(fixture: ComponentFixture<unknown>, type: Type<T>, selector: string) =>
  fixture.debugElement
    .query((node) => (node.nativeElement as Element | null)?.matches?.(selector) ?? false)
    .injector.get(type);

export const hostElement = (fixture: ComponentFixture<unknown>) =>
  fixture.debugElement.children[0]!.nativeElement as HTMLElement;

/**
 * Queries the fixture's root element, narrowing `nativeElement` (typed `any`) to `HTMLElement`
 * once - a generic call directly through `fixture.nativeElement.querySelectorAll<E>(...)` fails
 * with TS2347 and collapses every downstream member access to `{}`.
 */
export const queryAll = <E extends Element = HTMLElement>(fixture: ComponentFixture<unknown>, selector: string) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<E>(selector));

/** Single-result counterpart of {@link queryAll}. */
export const query = <E extends Element = HTMLElement>(fixture: ComponentFixture<unknown>, selector: string) =>
  (fixture.nativeElement as HTMLElement).querySelector<E>(selector);

export const pressKey = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

  target.dispatchEvent(event);
  tick();

  return event;
};

export const focusEvent = (target: EventTarget, type: 'focus' | 'blur') => {
  target.dispatchEvent(new FocusEvent(type));
  tick();
};

export const pointerEnter = (target: EventTarget) => {
  target.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
  tick();
};

export const pointerEvent = (target: EventTarget, type: string, init: PointerEventInit = {}) => {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
  tick();
};

export const setInputValue = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  tick();
};

export const focusField = (field: HTMLInputElement) => {
  field.focus();
  field.dispatchEvent(new FocusEvent('focus'));
  tick();
};

export const typeInField = (field: HTMLInputElement, text: string) => {
  field.focus();
  setInputValue(field, text);
};

/**
 * Types `text` one character at a time, each with its own `input` event and the caret left after
 * the inserted character - what a real keyboard produces. Use it instead of {@link typeInField}
 * whenever the control reads or rewrites the element between keystrokes; a whole-string
 * {@link setInputValue} hides every defect that only appears mid-entry.
 */
export const typeChars = (field: HTMLInputElement, text: string) => {
  field.focus();

  for (const char of text) {
    const caret = field.selectionStart ?? field.value.length;

    field.value = field.value.slice(0, caret) + char + field.value.slice(caret);
    field.setSelectionRange(caret + 1, caret + 1);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    tick();
  }
};

export const blurField = (field: HTMLInputElement) => {
  field.blur();
  field.dispatchEvent(new Event('blur'));
  tick();
};

export const pointerDownOutside = () => {
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
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
