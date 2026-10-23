// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { placeOverlays } from '../../../design/define-call';

const overlay = (inner: string) =>
  `<div class="et-overlay-runtime-root" style="position: fixed"><div class="et-overlay-runtime-entry" style="position: fixed">` +
  `<div class="et-overlay-runtime-pane">${inner}</div></div></div>`;

const rect = (element: Element | null, box: { top: number; left: number; width: number; height: number }) => {
  if (!element) throw new Error('no element');

  element.getBoundingClientRect = () =>
    ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height }) as DOMRect;
};

const mount = (markup: string) => {
  const root = document.createElement('div');

  root.innerHTML = markup;
  document.body.replaceChildren(root);

  return root;
};

describe('placeOverlays', () => {
  it('places a pane below the start of the element whose aria-controls names an id inside it', () => {
    const root = mount(
      `<div data-de-states="open" style="display: contents"><button aria-controls="other">no</button>` +
        `<div id="trigger" aria-expanded="true" aria-controls="listbox-1">Pick</div>` +
        overlay('<div id="listbox-1"></div>') +
        '</div>',
    );

    rect(root.querySelector('#trigger'), { top: 40, left: 30, width: 200, height: 36 });
    rect(root.querySelector('.et-overlay-runtime-entry'), { top: 10, left: 10, width: 800, height: 600 });
    placeOverlays(root);

    const pane = root.querySelector<HTMLElement>('.et-overlay-runtime-pane');

    expect(pane?.style.top).toBe('70px');
    expect(pane?.style.left).toBe('20px');
    expect(pane?.style.minWidth).toBe('200px');
    expect(root.querySelector<HTMLElement>('.et-overlay-runtime-root')?.style.position).toBe('absolute');
    expect(root.querySelector<HTMLElement>('.et-overlay-runtime-entry')?.style.position).toBe('absolute');
  });

  it('falls back to the last expanded element before a pane that no aria-controls names', () => {
    const root = mount(
      `<button id="first" aria-expanded="true">a</button><button id="second" aria-expanded="true">b</button>` +
        overlay('<et-menu></et-menu>') +
        `<button id="after" aria-expanded="true">c</button>`,
    );

    rect(root.querySelector('#second'), { top: 0, left: 120, width: 80, height: 32 });
    placeOverlays(root);

    expect(root.querySelector<HTMLElement>('.et-overlay-runtime-pane')?.style.left).toBe('120px');
  });

  it('places a pane under the form field control frame around its trigger', () => {
    const root = mount(
      `<div class="et-form-field-control-frame"><div aria-controls="l-2">Pick</div></div>` +
        overlay('<div id="l-2"></div>'),
    );

    rect(root.querySelector('.et-form-field-control-frame'), { top: 0, left: 8, width: 280, height: 48 });
    placeOverlays(root);

    const pane = root.querySelector<HTMLElement>('.et-overlay-runtime-pane');

    expect([pane?.style.top, pane?.style.left, pane?.style.minWidth]).toEqual(['52px', '8px', '280px']);
  });
});
