import { trackPointerFocus } from './pointer-focus';

const mount = () => {
  const element = document.createElement('div');

  trackPointerFocus(element);

  element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));

  return element;
};

describe('trackPointerFocus', () => {
  it('keeps the mark through a modifier key press', () => {
    const element = mount();

    for (const code of ['ShiftLeft', 'ControlRight', 'AltLeft', 'MetaLeft']) {
      element.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    }

    expect('pointerFocus' in element.dataset).toBe(true);
  });

  it('clears the mark on a navigation key press', () => {
    const element = mount();

    element.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true }));

    expect('pointerFocus' in element.dataset).toBe(false);
  });
});
