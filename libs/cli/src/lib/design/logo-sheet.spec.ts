// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { logoSheet, LogoSheetOptions } from '../../../design/logo-sheet';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M0 0h1"/></svg>';

const draw = (marks: LogoSheetOptions['marks']) => {
  const root = document.createElement('div');
  root.innerHTML = logoSheet({ marks }).body;

  return root;
};

describe('logoSheet', () => {
  it('draws each mark under its title at each size, with a size label', () => {
    const root = draw([
      { title: 'Mark', svg, sizes: [16, 512] },
      { title: 'Line', svg, sizes: [24] },
    ]);

    expect([...root.querySelectorAll('.lgs-title')].map((title) => title.textContent)).toEqual(['Mark', 'Line']);
    expect([...root.querySelectorAll('.lgs-row')].map((row) => row.querySelectorAll('svg').length)).toEqual([2, 1]);
    expect([...root.querySelectorAll('.lgs-item > svg')].map((mark) => mark.getAttribute('width'))).toEqual([
      '16',
      '512',
      '24',
    ]);
    expect([...root.querySelectorAll('.lgs-label')].map((label) => label.textContent)).toEqual([
      '16 px',
      '512 px',
      '24 px',
    ]);
    expect(root.querySelector('.lgs-plate')).toBeNull();
  });

  it('draws the onLight sizes on one light bar', () => {
    const root = draw([{ title: 'Mark', svg, sizes: [16], onLight: [16, 32] }]);
    const plate = root.querySelector('.lgs-plate');

    expect([...(plate?.querySelectorAll('svg') ?? [])].map((mark) => mark.getAttribute('height'))).toEqual([
      '16',
      '32',
    ]);
    expect(plate?.nextElementSibling?.textContent).toBe('on a light bar');
  });

  it('draws no light bar for an empty onLight', () => {
    const root = draw([{ title: 'Mark', svg, sizes: [16], onLight: [] }]);

    expect(root.querySelector('.lgs-row')?.textContent?.trim()).toBe('16 px');
  });
});
