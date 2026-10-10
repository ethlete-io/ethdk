import { OverlayRuntimeRef } from './overlay-runtime-ref';
import { OverlayRuntimeAutoFocusTarget } from './overlay-runtime.types';

export const FOCUSABLE_SELECTOR = /* @__PURE__ */ [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'details > summary:first-of-type',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

export const isHTMLElement = (value: unknown): value is HTMLElement => {
  // `instanceof` is realm-bound: an element adopted by a same-origin pop-up (the `document` mount
  // option) belongs to that window's `HTMLElement`, not to this one's.
  const view = (value as Node | null | undefined)?.ownerDocument?.defaultView;

  return view ? value instanceof view.HTMLElement : value instanceof HTMLElement;
};

export const isElement = (value: unknown): value is Element => {
  const view = (value as Node | null | undefined)?.ownerDocument?.defaultView;

  return view ? value instanceof view.Element : value instanceof Element;
};

export const isHTMLOrSVGElement = (value: unknown): value is HTMLElement | SVGElement => {
  const view = (value as Node | null | undefined)?.ownerDocument?.defaultView;

  return view
    ? value instanceof view.HTMLElement || value instanceof view.SVGElement
    : value instanceof HTMLElement || value instanceof SVGElement;
};

/**
 * Whether the overlay rooted at `hostElement` is still the owner of DOM focus - focus is inside it, or
 * nothing is focused. False once the user has moved focus somewhere else.
 */
export const ownsActiveElement = (hostElement: HTMLElement, document: Document) => {
  const activeElement = document.activeElement;

  return !activeElement || activeElement === document.body || hostElement.contains(activeElement);
};

export const isFocusable = (element: HTMLElement, document: Document) => {
  const view = document.defaultView;
  const style = view?.getComputedStyle(element);
  const isVisible = style?.display !== 'none' && style?.visibility !== 'hidden' && element.getClientRects().length > 0;

  return (
    isVisible &&
    !element.hasAttribute('disabled') &&
    !element.matches(':disabled') &&
    !element.closest('[inert]') &&
    element.tabIndex >= 0
  );
};

const isNamedRadio = (element: Element): element is HTMLInputElement =>
  element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'radio' && !!(element as HTMLInputElement).name;

const isSameTabStop = (a: Element, b: Element) =>
  a === b || (isNamedRadio(a) && isNamedRadio(b) && a.name === b.name && a.form === b.form);

/** The elements Tab stops on inside `container`, with each named radio group collapsed to its checked (else first) radio. */
export const getFocusableElements = (container: HTMLElement, document: Document) => {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
    isFocusable(el, document),
  );

  return elements.filter((element) => {
    if (!isNamedRadio(element)) {
      return true;
    }

    const group = elements.filter((other): other is HTMLInputElement => isSameTabStop(element, other));

    return (group.find((radio) => radio.checked) ?? group[0]) === element;
  });
};

export const getHeadingElement = (container: HTMLElement) => {
  return container.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]');
};

export const focusElement = (element: HTMLElement | null) => {
  if (!element) {
    return;
  }

  element.focus({ preventScroll: true });
};

export const applyInitialFocus = (
  paneElement: HTMLElement,
  autoFocus: OverlayRuntimeAutoFocusTarget | string | false,
  document: Document,
) => {
  if (autoFocus === false) {
    return;
  }

  if (autoFocus === 'container') {
    focusElement(paneElement);

    return;
  }

  if (autoFocus === 'first-heading') {
    focusElement(getHeadingElement(paneElement) ?? paneElement);

    return;
  }

  if (autoFocus === 'first-tabbable') {
    focusElement(getFocusableElements(paneElement, document)[0] ?? paneElement);

    return;
  }

  try {
    focusElement(paneElement.querySelector<HTMLElement>(autoFocus) ?? paneElement);
  } catch {
    focusElement(paneElement);
  }
};

export const setupFocusTrap = (
  paneElement: HTMLElement,
  overlayRef: OverlayRuntimeRef<object, unknown>,
  enabled: boolean,
  isTopMost: (ref: OverlayRuntimeRef<object, unknown>) => boolean,
  document: Document,
) => {
  if (!enabled) {
    return () => undefined;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !isTopMost(overlayRef)) {
      return;
    }

    const focusableElements = getFocusableElements(paneElement, document);
    if (focusableElements.length === 0) {
      event.preventDefault();
      focusElement(paneElement);

      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (!activeElement || !paneElement.contains(activeElement)) {
      event.preventDefault();
      focusElement(event.shiftKey ? (lastElement ?? null) : (firstElement ?? null));

      return;
    }

    if (event.shiftKey && firstElement && isSameTabStop(activeElement, firstElement)) {
      event.preventDefault();
      focusElement(lastElement ?? null);

      return;
    }

    if (!event.shiftKey && lastElement && isSameTabStop(activeElement, lastElement)) {
      event.preventDefault();
      focusElement(firstElement ?? null);
    }
  };

  document.addEventListener('keydown', onKeyDown, true);

  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
  };
};
