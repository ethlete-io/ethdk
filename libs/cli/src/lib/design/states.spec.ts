// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { switchStates } from '../../../design/define-call';

const mount = () => {
  const root = document.createElement('div');

  root.innerHTML = '<div data-de-states="closed"><button class="trigger">open</button></div>';
  document.body.replaceChildren(root);

  switchStates({ closed: '<button class="trigger">open</button>', open: '<p>panel</p><button data-close>x</button>' }, [
    { click: '.trigger', go: 'open' },
    { click: '[data-close]', go: 'closed' },
  ])(root);

  return root;
};

describe('switchStates', () => {
  it('swaps the state host on a matching click, and keeps working after the swap', () => {
    const root = mount();

    root.querySelector<HTMLElement>('.trigger')?.click();
    expect(root.querySelector('[data-de-states]')?.getAttribute('data-de-states')).toBe('open');
    expect(root.textContent).toContain('panel');

    root.querySelector<HTMLElement>('[data-close]')?.click();
    expect(root.querySelector('[data-de-states]')?.getAttribute('data-de-states')).toBe('closed');
  });

  it('ignores a click no rule matches', () => {
    const root = mount();

    root.querySelector<HTMLElement>('[data-de-states]')?.click();
    expect(root.querySelector('[data-de-states]')?.getAttribute('data-de-states')).toBe('closed');
  });

  it('names the missing state host', () => {
    expect(() => switchStates({ a: '' }, [])(document.createElement('div'))).toThrow('[data-de-states]');
  });
});
