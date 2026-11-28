// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { compareBoxesScriptOf, designRootOf, DRAWN_PANES } from './compare-boxes';

type Edges = { left: number; top: number; right: number; bottom: number };

const placeAt = (selector: string, edges: Edges) => {
  const element = document.querySelector(selector) as HTMLElement;

  element.getBoundingClientRect = () =>
    ({
      ...edges,
      x: edges.left,
      y: edges.top,
      width: edges.right - edges.left,
      height: edges.bottom - edges.top,
    }) as DOMRect;
};

const measure = () =>
  (0, eval)(compareBoxesScriptOf({ root: "document.getElementById('root')", panes: DRAWN_PANES })) as {
    panes: Edges[];
  };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('compareBoxesScriptOf with the drawn panes', () => {
  // A drawn wrapper with data-overlay-placement counts as the pane in compare.
  it('takes a drawn wrapper that declares its overlay placement as the pane, with the arrow beside the menu', () => {
    document.body.innerHTML =
      '<div id="root"><div id="wrapper" data-overlay-placement="right-start">' +
      '<div id="arrow" class="et-overlay-arrow"></div><et-menu id="menu" class="et-menu"></et-menu></div></div>';
    placeAt('#root', { left: 0, top: 0, right: 400, bottom: 400 });
    placeAt('#wrapper', { left: 10, top: 10, right: 268, bottom: 200 });
    placeAt('#arrow', { left: 10, top: 20, right: 20, bottom: 30 });
    placeAt('#menu', { left: 20, top: 10, right: 268, bottom: 200 });

    expect(measure().panes).toEqual([{ left: 10, top: 10, right: 268, bottom: 200 }]);
  });
});

describe('compareBoxesScriptOf with the design root of a part', () => {
  const measureRoot = () =>
    (0, eval)(compareBoxesScriptOf({ root: designRootOf('components/disclosure'), panes: DRAWN_PANES })) as {
      root: Edges;
    };

  it('boxes every top-level element of an open disclosure drawing, not only the marked toggle', () => {
    document.body.innerHTML =
      '<div id="root"><button id="toggle" data-et-part="components/disclosure" aria-expanded="true"></button>' +
      '<div id="panel" class="st-disclosure-panel" data-et-surface="toggle.body"><ul></ul></div></div>';
    placeAt('#root', { left: 0, top: 0, right: 320, bottom: 70 });
    placeAt('#toggle', { left: 0, top: 0, right: 320, bottom: 26 });
    placeAt('#panel', { left: 0, top: 26, right: 320, bottom: 70 });

    expect(measureRoot().root).toEqual({ left: 0, top: 0, right: 320, bottom: 70 });
  });

  it('keeps a part embedded in another drawing to its own marked element', () => {
    document.body.innerHTML =
      '<div id="root"><section><button id="toggle" data-et-part="components/disclosure"></button>' +
      '<div id="next"></div></section></div>';
    placeAt('#toggle', { left: 0, top: 0, right: 320, bottom: 26 });
    placeAt('#next', { left: 0, top: 26, right: 320, bottom: 70 });

    expect(measureRoot().root).toEqual({ left: 0, top: 0, right: 320, bottom: 26 });
  });
});
