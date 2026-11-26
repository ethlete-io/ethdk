export const leavesWindow = (element: HTMLElement) => !element.ownerDocument.hasFocus();

export const trackPointerFocus = (element: HTMLElement) => {
  const clear = () => delete element.dataset['pointerFocus'];

  element.addEventListener('pointerdown', (event) => {
    if (event.button === 0 || event.button === 1) element.dataset['pointerFocus'] = '';
  });
  element.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') clear();
  });
  element.addEventListener('blur', () => {
    if (!leavesWindow(element)) clear();
  });
};
