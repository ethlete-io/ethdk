import { claimsPointerAxis, isInteractivePointerTarget } from './pointer-gesture-target';

describe('pointer gesture target', () => {
  let boundary: HTMLElement;

  beforeEach(() => {
    boundary = document.createElement('div');
    document.body.appendChild(boundary);
  });

  afterEach(() => boundary.remove());

  const appendChild = (touchAction?: string) => {
    const child = document.createElement('div');

    if (touchAction) child.style.touchAction = touchAction;

    boundary.appendChild(child);

    return child;
  };

  describe('isInteractivePointerTarget', () => {
    it.each(['input', 'textarea', 'select', 'button', 'a'])('claims a %s', (tag) => {
      expect(isInteractivePointerTarget(document.createElement(tag))).toBe(true);
    });

    it.each(['div', 'span', 'li'])('leaves a %s alone', (tag) => {
      expect(isInteractivePointerTarget(document.createElement(tag))).toBe(false);
    });
  });

  describe('claimsPointerAxis', () => {
    it.each([
      ['none', true, true],
      ['pan-x', false, true],
      ['pan-y', true, false],
      ['manipulation', false, false],
      ['auto', false, false],
      ['pan-y pinch-zoom', true, false],
    ])('reads %s as claiming x: %s, y: %s', (touchAction, claimsX, claimsY) => {
      const child = appendChild(touchAction);

      expect(claimsPointerAxis(child, { boundary, axis: 'x' })).toBe(claimsX);
      expect(claimsPointerAxis(child, { boundary, axis: 'y' })).toBe(claimsY);
    });

    it('reads an element that declares nothing as claiming neither axis', () => {
      const child = appendChild();

      expect(claimsPointerAxis(child, { boundary, axis: 'x' })).toBe(false);
      expect(claimsPointerAxis(child, { boundary, axis: 'y' })).toBe(false);
    });

    it('checks every element between the target and the boundary', () => {
      const area = appendChild('none');
      const thumb = document.createElement('span');
      area.appendChild(thumb);

      expect(claimsPointerAxis(thumb, { boundary, axis: 'y' })).toBe(true);
    });

    it('stops at the boundary, so the boundary itself never claims the axis', () => {
      boundary.style.touchAction = 'none';

      expect(claimsPointerAxis(boundary, { boundary, axis: 'y' })).toBe(false);
    });
  });
});
