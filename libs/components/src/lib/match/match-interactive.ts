const NATIVELY_INTERACTIVE_TAGS = ['A', 'BUTTON'];

export const isNativelyInteractiveElement = (element: HTMLElement) =>
  NATIVELY_INTERACTIVE_TAGS.includes(element.tagName);
