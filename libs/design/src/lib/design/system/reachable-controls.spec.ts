// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { REACHABLE_CONTROLS_STATEMENTS } from './reachable-controls';

const reachable = (html: string, keepHidden = false) => {
  document.body.innerHTML = `<div id="root">${html}</div>`;
  const run = new Function(
    'scope',
    'keepHidden',
    `${REACHABLE_CONTROLS_STATEMENTS}; return reachableControlsOf(scope, 'button', keepHidden);`,
  );

  return (run(document.getElementById('root'), keepHidden) as Element[]).map((element) => element.id);
};

describe('reachableControlsOf', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps a normal control', () => {
    expect(reachable('<button id="a"></button>')).toEqual(['a']);
  });

  it('drops a control under an inert subtree', () => {
    expect(reachable('<div inert><button id="a"></button></div><button id="b"></button>')).toEqual(['b']);
  });

  it('drops a control under aria-hidden', () => {
    expect(reachable('<div aria-hidden="true"><button id="a"></button></div>')).toEqual([]);
  });

  it('drops a control under a hidden attribute', () => {
    expect(reachable('<div hidden><button id="a"></button></div>')).toEqual([]);
  });

  it('drops a control under display none', () => {
    expect(reachable('<div style="display: none"><button id="a"></button></div>')).toEqual([]);
  });

  it('keeps a hidden control for a rule that reports it, but not an inert one', () => {
    expect(reachable('<button id="a" hidden></button><div inert><button id="b"></button></div>', true)).toEqual(['a']);
  });
});
