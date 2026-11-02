// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from './action-press';
import { drawnPaneCountOf } from './compare-command';
import { settledPanesOf, settledPanesScript } from './settled-panes';

type Page = Parameters<typeof settledPanesOf>[0]['page'];

const pageOf = () => {
  const waitForFunction = vi.fn(() => Promise.reject(new Error('Timeout 1ms exceeded')));

  return { page: { waitForFunction } as unknown as Page, waitForFunction };
};

describe('waits with a spent budget', () => {
  it('settledPanesOf gives Playwright 1 ms, not the 0 it reads as no limit', async () => {
    const { page, waitForFunction } = pageOf();

    await expect(settledPanesOf({ page, count: 1, timeout: 0 })).resolves.toBe(false);

    for (const call of waitForFunction.mock.calls as unknown as [string, unknown, { timeout: number }][])
      expect(call[2].timeout).toBe(1);
  });

  it('settle gives Playwright 1 ms, not the 0 it reads as no limit', async () => {
    const { page, waitForFunction } = pageOf();

    await settle(page, 0);

    expect((waitForFunction.mock.calls[0] as unknown as [string, unknown, { timeout: number }])[2].timeout).toBe(1);
  });
});

describe('settledPanesScript', () => {
  let top = 0;
  const frame = () => new Function(`return ${settledPanesScript}`)() as boolean;
  const framesUntilSettled = () => {
    for (let frames = 1; frames <= 10; frames++) if (frame()) return frames;

    return null;
  };

  beforeEach(() => {
    top = 0;
    Object.assign(document, { getAnimations: () => [] });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, top, 100, 40));
    document.body.innerHTML = '<div class="et-overlay-runtime-pane"><et-menu>row</et-menu></div>';
    Object.assign(window, { __etPaneGeometry: undefined, __etSettledFrames: undefined });
  });

  afterEach(() => vi.restoreAllMocks());

  it('holds once the panes kept their geometry for three frames in a row', () => {
    expect(framesUntilSettled()).toBe(4);
  });

  it('starts counting again when a pane moves', () => {
    frame();
    frame();
    top = 12;

    expect(framesUntilSettled()).toBe(4);
  });

  it('does not hold while a pane is in its init or enter phase', () => {
    for (const phase of ['et-force-invisible', 'et-animation-enter-from']) {
      document.querySelector('et-menu')?.setAttribute('class', phase);

      expect(framesUntilSettled()).toBeNull();
    }
  });
});

describe('drawnPaneCountOf', () => {
  it('counts every mock the app renders in an overlay pane of its own', () => {
    const markup =
      '<et-overlay-container class="et-overlay"></et-overlay-container>' +
      '<div class="et-overlay et-overlay-runtime-pane et-tooltip-panel"><et-tooltip></et-tooltip></div>' +
      '<et-menu id="m" class="et-menu" role="menu"><et-menu-radio-item></et-menu-radio-item><et-menu-separator></et-menu-separator></et-menu>' +
      '<et-select-panel class="et-select-panel"></et-select-panel>';

    expect(drawnPaneCountOf(markup)).toBe(4);
    expect(drawnPaneCountOf('<div class="et-overlay-runtime-pane-ish"></div><et-menu-item></et-menu-item>')).toBe(0);
  });
});
