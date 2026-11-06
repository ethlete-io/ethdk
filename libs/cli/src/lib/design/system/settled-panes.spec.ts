// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from './action-press';
import { drawnPaneCountOf, missingPanesProblemOf } from './harness-shot';
import { PANE_COUNT_TIMEOUT_MS, settledPanesOf, settledPanesScript } from './settled-panes';

type Page = Parameters<typeof settledPanesOf>[0]['page'];

const pageOf = (panes = 0) => {
  const waitForFunction = vi.fn(() => Promise.reject(new Error('Timeout 1ms exceeded')));
  const evaluate = vi.fn(() => Promise.resolve(panes));

  return { page: { waitForFunction, evaluate } as unknown as Page, waitForFunction };
};

describe('waits with a spent budget', () => {
  it('settledPanesOf gives Playwright 1 ms, not the 0 it reads as no limit', async () => {
    const { page, waitForFunction } = pageOf();

    await expect(settledPanesOf({ page, count: 1, timeout: 0 })).resolves.toEqual({ settled: false, opened: 0 });

    for (const call of waitForFunction.mock.calls as unknown as [string, unknown, { timeout: number }][])
      expect(call[2].timeout).toBe(1);
  });

  it('settle gives Playwright 1 ms, not the 0 it reads as no limit', async () => {
    const { page, waitForFunction } = pageOf();

    await settle(page, 0);

    expect((waitForFunction.mock.calls[0] as unknown as [string, unknown, { timeout: number }])[2].timeout).toBe(1);
  });
});

describe('settledPanesOf with drawn panes', () => {
  it('waits at most PANE_COUNT_TIMEOUT_MS for the panes, not the whole shot timeout', async () => {
    const { page, waitForFunction } = pageOf(1);

    await settledPanesOf({ page, count: 2, timeout: 15_000 });

    const [first] = waitForFunction.mock.calls as unknown as [string, unknown, { timeout: number }][];

    expect(PANE_COUNT_TIMEOUT_MS).toBeLessThanOrEqual(1_000);
    expect(first?.[2].timeout).toBe(PANE_COUNT_TIMEOUT_MS);
  });

  it('ends the pane wait early once the open panes settle without a new one', async () => {
    const { page, waitForFunction } = pageOf(1);

    await settledPanesOf({ page, count: 2, timeout: 15_000 });

    const [first] = waitForFunction.mock.calls as unknown as [string][];

    expect(first?.[0]).toContain(settledPanesScript);
  });

  it('names how many panes opened when fewer than drawn did, and none when all did', async () => {
    const { page } = pageOf(1);
    const all = pageOf(2);

    await expect(settledPanesOf({ page, count: 2, timeout: 15_000 })).resolves.toEqual({ settled: false, opened: 1 });
    await expect(settledPanesOf({ page: all.page, count: 2, timeout: 15_000 })).resolves.toEqual({
      settled: false,
      opened: null,
    });
    expect(missingPanesProblemOf({ drawn: 2, opened: 1 })).toBe(
      `the design draws 2 overlay panes, the app opened 1 before its panes settled or ${PANE_COUNT_TIMEOUT_MS} ms passed`,
    );
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

  it('skips the closed studio menu every pages/sketches state embeds', () => {
    const surface = (hidden: string) =>
      `<button data-et-slot="elements/shell-main" data-et-action="open" data-et-control="studio-menu" data-studio-trigger="" data-et-auto-surface="" aria-label="Studio-Menü" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-menu-surface" class="et-button et-focus-ring st-studio-trigger p-0" type="button" data-variant="transparent" data-size="sm"><div data-et-slot="elements/shell-main" class="et-button-icon"></div><div data-et-slot="elements/shell-main" class="et-button-contents"><svg data-et-slot="elements/shell-main" data-et-part="foundations/logo" width="40" height="40" viewBox="0 0 32 32" role="img" aria-label="Ethlete Studio"><g data-et-slot="elements/shell-main" color="var(--on-accent, #051211)"><rect data-et-slot="elements/shell-main" width="32" height="32" rx="8" fill="var(--accent, #25aea7)"></rect></g></svg>
</div></button>
      <div data-et-slot="elements/shell-main" id="studio-menu-surface" class="st-studio-menu absolute top-0 left-15 z-20 w-62" data-studio-menu="" data-et-surface="studio-menu.open"${hidden}>
        <et-menu data-et-slot="elements/shell-main" data-et-part="components/menu" id="et-menu-panel-menu" data-et-auto-surface="" class="et-menu et-color--brand et-surface--dark-elevated" role="menu" aria-orientation="vertical" tabindex="-1"><div data-et-slot="elements/shell-main" class="et-menu-header"><div data-et-slot="elements/shell-main" class="et-menu-search-field"></div></div><div data-et-slot="elements/shell-main" class="et-menu-body-wrapper"><div data-et-slot="elements/shell-main" class="et-menu-body"><div data-et-slot="elements/shell-main" class="et-menu-body-content"><et-menu-group-label data-et-slot="elements/shell-main" class="et-menu-group-label" role="presentation" id="et-menu-group-label-menu-0">Studio</et-menu-group-label><button et-menu-item="" type="button" role="menuitem" data-studio-action="restart" data-et-action="emit:serverAction" data-et-slot="components/menu elements/shell-main" tabindex="-1" class="et-menu-item et-color--inherited" data-variant="default"><span data-et-slot="elements/shell-main" class="et-menu-item-content">Design-Server neu starten</span></button></div></div></div></et-menu>
      </div>`;

    expect(drawnPaneCountOf(surface(' hidden=""'))).toBe(0);
    expect(drawnPaneCountOf(surface(''))).toBe(1);
    expect(drawnPaneCountOf(`<div hidden><br><input><img src="x"></div>${surface('')}`)).toBe(1);
    expect(drawnPaneCountOf(`<div class="a hidden" data-x="hidden"><et-menu></et-menu></div>`)).toBe(1);
  });
});
