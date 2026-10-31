import { anchoredDialog } from './anchored-dialog';
import { alertDialog, dialog } from './dialog';
import { menu } from './menu';
import { selectPanel } from './select';
import { tooltip } from './tooltip';

const parse = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;

  return host;
};

const paneOf = (html: string, selector: string) => {
  const pane = parse(html).querySelector(selector);

  if (!pane) throw new Error(`No ${selector} in the drawn markup`);

  return pane;
};

const surfaceClassesOf = (element: Element) =>
  Array.from(element.classList).filter((name) => name.startsWith('et-surface--'));

const renderers: [string, (surface?: string) => string, string][] = [
  ['dialog', (surface) => dialog({ title: 'Title', body: 'Body', surface }), 'et-overlay-container'],
  ['alertDialog', (surface) => alertDialog({ kind: 'alert', title: 'Title', surface }), 'et-overlay-container'],
  ['anchoredDialog', (surface) => anchoredDialog({ content: 'Content', surface }), 'et-overlay-container'],
  ['menu', (surface) => menu({ rows: [], surface }), 'et-menu'],
  ['selectPanel', (surface) => selectPanel({ id: 'a', content: '', surface }), 'et-select-panel'],
  ['tooltip', (surface) => tooltip({ text: 'Tip', surface }), '.et-overlay'],
];

describe('overlay design renderers', () => {
  describe.each(renderers)('%s', (_, render, selector) => {
    it('takes the surface one elevation up by default', () => {
      const pane = paneOf(render(), selector);

      expect(pane.hasAttribute('data-et-auto-surface')).toBe(true);
      expect(surfaceClassesOf(pane)).toEqual([]);
    });

    it('draws an explicit surface theme instead of the auto surface', () => {
      const pane = paneOf(render('raised'), selector);

      expect(pane.hasAttribute('data-et-auto-surface')).toBe(false);
      expect(surfaceClassesOf(pane)).toEqual(['et-surface--raised']);
    });
  });

  it('leaves the tooltip itself to inherit the auto surface of its pane', () => {
    expect(surfaceClassesOf(paneOf(tooltip({ text: 'Tip' }), 'et-tooltip'))).toEqual([]);
  });

  describe('anchoredDialog', () => {
    it('draws the anchored dialog pane with the arrow at the default placement', () => {
      const pane = paneOf(anchoredDialog({ content: '<p>Hi</p>', labelledBy: 'title' }), 'et-overlay-container');

      expect(pane.classList).toContain('et-overlay--anchored-dialog');
      expect(pane.getAttribute('role')).toBe('dialog');
      expect(pane.getAttribute('aria-modal')).toBe('true');
      expect(pane.getAttribute('aria-labelledby')).toBe('title');
      expect(pane.getAttribute('data-overlay-placement')).toBe('bottom-end');
      expect(pane.lastElementChild?.matches('.et-overlay-arrow[et-floating-arrow]')).toBe(true);
      expect(pane.querySelector(':scope > div > p')?.textContent).toBe('Hi');
    });

    it('draws a non-modal pane without an arrow', () => {
      const pane = paneOf(anchoredDialog({ content: '', arrow: false, modal: false }), 'et-overlay-container');

      expect(pane.hasAttribute('aria-modal')).toBe(false);
      expect(pane.querySelector('.et-overlay-arrow')).toBeNull();
    });
  });
});
