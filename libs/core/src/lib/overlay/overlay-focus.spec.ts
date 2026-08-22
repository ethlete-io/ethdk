import { applyInitialFocus, setupFocusTrap } from './overlay-focus';
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
