import { OverlayRuntimeRef } from './overlay-runtime-ref';
import { OverlayRuntimeAutoFocusTarget } from './overlay-runtime.types';

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export const isHTMLElement = (value: unknown): value is HTMLElement => {
  return value instanceof HTMLElement;
};

export const isFocusable = (element: HTMLElement, document: Document) => {
  const view = document.defaultView;
  const style = view?.getComputedStyle(element);
  const isVisible = style?.display !== 'none' && style?.visibility !== 'hidden' && element.getClientRects().length > 0;

  return isVisible && !element.hasAttribute('disabled') && element.tabIndex >= 0;
};

export const getFocusableElements = (container: HTMLElement, document: Document) => {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
    isFocusable(el, document),
  );
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

  focusElement(paneElement.querySelector<HTMLElement>(autoFocus) ?? paneElement);
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

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      focusElement(lastElement ?? null);
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      focusElement(firstElement ?? null);
    }
  };

  paneElement.addEventListener('keydown', onKeyDown);

  return () => {
    paneElement.removeEventListener('keydown', onKeyDown);
  };
};
