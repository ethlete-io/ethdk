// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { placeOverlays } from '../../../design/define-call';

const overlay = (inner: string) =>
  `<div class="et-overlay-runtime-root" style="position: fixed"><div class="et-overlay-runtime-entry" style="position: fixed">` +
  `<div class="et-overlay-runtime-pane">${inner}</div></div></div>`;

const entry = (options: { id: string; inner: string; pane?: string }) =>
  `<div class="et-overlay-runtime-entry" id="${options.id}" style="position: fixed">` +
  `<div class="et-overlay et-overlay-runtime-pane ${options.pane ?? 'et-overlay--anchored'}" style="left: 0; top: 0">` +
  `${options.inner}</div></div>`;

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

  it('pairs each of two open overlays with the trigger whose aria-controls names its entry', () => {
    const root = mount(
      `<div etoverlay><button id="a" aria-expanded="true" aria-controls="panel-0">A</button></div>` +
        `<div etoverlay><button id="b" aria-expanded="true" aria-controls="panel-1">B</button></div>` +
        `<div class="et-overlay-runtime-root">${entry({ id: 'panel-0', inner: 'A' })}${entry({ id: 'panel-1', inner: 'B' })}</div>`,
    );

    rect(root.querySelector('#a'), { top: 0, left: 10, width: 50, height: 20 });
    rect(root.querySelector('#b'), { top: 0, left: 300, width: 60, height: 20 });
    placeOverlays(root);

    const [first, second] = root.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane');

    expect([first?.style.left, second?.style.left]).toEqual(['10px', '300px']);
  });

  it('aligns the end of the pane with the end of its trigger for an end placement, and goes above for top', () => {
    const root = mount(
      `<div etoverlay placement="bottom-end"><button id="a" aria-controls="p-0">A</button></div>` +
        `<div etoverlay placement="top-start"><button id="b" aria-controls="p-1">B</button></div>` +
        `<div class="et-overlay-runtime-root">${entry({ id: 'p-0', inner: '' })}${entry({ id: 'p-1', inner: '' })}</div>`,
    );

    rect(root.querySelector('#a'), { top: 100, left: 600, width: 100, height: 30 });
    rect(root.querySelector('#b'), { top: 400, left: 20, width: 80, height: 30 });

    for (const container of root.querySelectorAll('.et-overlay-runtime-entry')) {
      rect(container, { top: 0, left: 0, width: 800, height: 600 });
    }

    placeOverlays(root);

    const [end, top] = root.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane');

    expect([end?.style.top, end?.style.left, end?.style.right]).toEqual(['134px', 'auto', '100px']);
    expect([top?.style.top, top?.style.bottom, top?.style.left]).toEqual(['auto', '204px', '20px']);
  });

  it('prefers the placement the runtime wrote on the pane', () => {
    const root = mount(
      `<div etoverlay placement="bottom-start"><button id="a" aria-controls="p-0">A</button></div>` +
        `<div class="et-overlay-runtime-root">${entry({ id: 'p-0', inner: '' })}</div>`,
    );

    root.querySelector('.et-overlay-runtime-pane')?.setAttribute('data-overlay-placement', 'bottom-end');
    rect(root.querySelector('#a'), { top: 0, left: 600, width: 100, height: 30 });
    rect(root.querySelector('.et-overlay-runtime-entry'), { top: 0, left: 0, width: 800, height: 600 });
    placeOverlays(root);

    expect(root.querySelector<HTMLElement>('.et-overlay-runtime-pane')?.style.right).toBe('100px');
  });

  it('pins a bottom sheet to the bottom of the frame at full width, with or without a trigger', () => {
    const root = mount(
      `<div class="et-overlay-runtime-root">${entry({ id: 's', inner: 'Sheet', pane: 'et-overlay--bottom-sheet' })}</div>`,
    );

    placeOverlays(root);

    const pane = root.querySelector<HTMLElement>('.et-overlay-runtime-pane');

    expect([pane?.style.top, pane?.style.bottom, pane?.style.left, pane?.style.right]).toEqual([
      'auto',
      '0px',
      '0px',
      '0px',
    ]);
  });
});
