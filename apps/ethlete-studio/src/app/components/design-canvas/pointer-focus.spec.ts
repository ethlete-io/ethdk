import { vi } from 'vitest';
import { trackPointerFocus } from './pointer-focus';

const mount = () => {
  const element = document.createElement('div');

  trackPointerFocus(element);

  element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));

  return element;
};

describe('trackPointerFocus', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the mark through modifier and canvas key presses', () => {
    const element = mount();

    for (const code of ['ShiftLeft', 'ControlRight', 'AltLeft', 'MetaLeft', 'ArrowRight', 'Space', 'Digit1']) {
      element.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    }

    expect('pointerFocus' in element.dataset).toBe(true);
  });

  it('clears the mark on Tab', () => {
    const element = mount();

    element.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true }));

    expect('pointerFocus' in element.dataset).toBe(false);
  });

  it('keeps the mark when the blur comes from the window losing focus', () => {
    const element = mount();
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    element.dispatchEvent(new FocusEvent('blur'));

    expect('pointerFocus' in element.dataset).toBe(true);
  });

  it('clears the mark when focus moves inside the document', () => {
    const element = mount();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    element.dispatchEvent(new FocusEvent('blur'));

    expect('pointerFocus' in element.dataset).toBe(false);
  });
});
