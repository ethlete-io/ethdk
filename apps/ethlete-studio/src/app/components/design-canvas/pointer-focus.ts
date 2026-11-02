const MODIFIERS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

export const leavesWindow = (element: HTMLElement) => !element.ownerDocument.hasFocus();

export const trackPointerFocus = (element: HTMLElement) => {
  const clear = () => delete element.dataset['pointerFocus'];

  element.addEventListener('pointerdown', (event) => {
    if (event.button === 0 || event.button === 1) element.dataset['pointerFocus'] = '';
  });
  element.addEventListener('keydown', (event) => {
    if (!MODIFIERS.has(event.code)) clear();
  });
  element.addEventListener('blur', () => {
    if (!leavesWindow(element)) clear();
  });
};
