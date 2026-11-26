import { applyInitialFocus, isHTMLElement, setupFocusTrap } from './overlay-focus';
import { OverlayRuntimeRef } from './overlay-runtime-ref';

describe('overlay focus utilities', () => {
  it('pulls focus back into a modal when Tab starts outside it', () => {
    const outside = document.createElement('button');
    const pane = document.createElement('div');
    const first = document.createElement('button');
    const last = document.createElement('button');
    pane.append(first, last);
    document.body.append(outside, pane);
    vi.spyOn(first, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
    vi.spyOn(last, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList);

    const cleanup = setupFocusTrap(pane, {} as OverlayRuntimeRef<object, unknown>, true, () => true, document);
    outside.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    outside.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    cleanup();
    outside.remove();
    pane.remove();
  });

  it('falls back to the pane for a malformed autofocus selector', () => {
    const pane = document.createElement('div');
    pane.tabIndex = -1;
    document.body.appendChild(pane);

    expect(() => applyInitialFocus(pane, '[', document)).not.toThrow();
    expect(document.activeElement).toBe(pane);

    pane.remove();
  });
});

describe('isHTMLElement', () => {
  it('recognises an element from another document', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);

    const foreignDocument = frame.contentDocument!;
    const foreignElement = foreignDocument.createElement('button');
    foreignDocument.body.appendChild(foreignElement);

    expect(foreignElement instanceof HTMLElement).toBe(false);
    expect(isHTMLElement(foreignElement)).toBe(true);

    frame.remove();
  });

  it('is false for anything that is not an element', () => {
    expect(isHTMLElement(null)).toBe(false);
    expect(isHTMLElement(undefined)).toBe(false);
    expect(isHTMLElement('button')).toBe(false);
    expect(isHTMLElement(document)).toBe(false);
    expect(isHTMLElement(window)).toBe(false);
    expect(isHTMLElement(document.createTextNode('text'))).toBe(false);
  });

  it('wraps Tab from the checked radio of a trailing native radio group', () => {
    const pane = document.createElement('div');
    const button = document.createElement('button');
    const radios = ['a', 'b', 'c'].map((value) => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'choice';
      radio.value = value;

      return radio;
    });
    const [firstRadio, checkedRadio] = radios as [HTMLInputElement, HTMLInputElement, HTMLInputElement];
    checkedRadio.checked = true;
    pane.append(button, ...radios);
    document.body.append(pane);

    for (const element of [button, ...radios]) {
      vi.spyOn(element, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
    }

    const cleanup = setupFocusTrap(pane, {} as OverlayRuntimeRef<object, unknown>, true, () => true, document);
    const pressTab = (target: HTMLElement, shiftKey = false) => {
      target.focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      target.dispatchEvent(event);

      return event;
    };

    expect(pressTab(checkedRadio).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button);

    expect(pressTab(button, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(checkedRadio);

    checkedRadio.checked = false;

    expect(pressTab(radios[2] as HTMLInputElement).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(pressTab(button, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(firstRadio);

    cleanup();
    pane.remove();
  });
});
