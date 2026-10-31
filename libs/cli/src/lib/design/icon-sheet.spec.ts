// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { iconSheet, IconSheetOptions } from '../../../design/icon-sheet';

const svg = (box: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"><path d="M0 0h1"/></svg>`;

const icons: IconSheetOptions['icons'] = [
  { name: 'check', svg: svg('0 0 16 16') },
  { name: 'close', svg: svg('0 0 16 16') },
  { name: 'chevron', svg: svg('0 0 448 512') },
  { name: 'star', svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>', grid: 24, padding: 2 },
];

const draw = (options: Partial<IconSheetOptions>) => {
  const root = document.createElement('div');
  root.innerHTML = iconSheet({ view: 'catalogue', title: 'Icons', icons, ...options }).body;

  return root;
};

describe('iconSheet', () => {
  it('draws every icon at each size with its name in the catalogue, one group per grid', () => {
    const root = draw({ sizes: [12, 20] });

    expect([...root.querySelectorAll('.ics-name')].map((name) => name.textContent)).toEqual([
      'check',
      'close',
      'chevron',
      'star',
    ]);
    expect([...root.querySelectorAll('.ics-cell svg')].map((icon) => icon.getAttribute('width'))).toEqual(
      Array.from({ length: 4 }, () => ['12', '20']).flat(),
    );
    expect([...root.querySelectorAll('.ics-group')].map((group) => group.textContent)).toEqual([
      '16 px grid',
      '512-unit grid',
      '24 px grid',
    ]);
  });

  it('labels no group when every icon shares one grid', () => {
    expect(draw({ icons: icons.slice(0, 2) }).querySelector('.ics-group')).toBeNull();
  });

  it('draws each icon of the construction on its own grid, with centre lines and the padding box', () => {
    const root = draw({ view: 'construction', size: 64 });
    const frames = [...root.querySelectorAll('.ics-frame')];
    const of = (index: number) => {
      const frame = frames[index];
      const key = frame?.querySelector('.ics-key');

      return {
        grids: [...(frame?.querySelectorAll('.ics-guides') ?? [])].map((guide) => guide.getAttribute('viewBox')),
        pixelLines: frame?.querySelectorAll('.ics-pixels path').length,
        icon: frame?.querySelector('.ics-icon')?.getAttribute('width'),
        centre: key?.querySelector('path')?.getAttribute('d'),
        padding: ['x', 'width'].map((name) => key?.querySelector('rect')?.getAttribute(name)),
      };
    };

    expect(frames).toHaveLength(4);
    expect(of(0)).toEqual({
      grids: ['0 0 16 16', '0 0 16 16'],
      pixelLines: 15,
      icon: '64',
      centre: 'M8 0V16M0 8H16',
      padding: ['2', '12'],
    });
    expect(of(2)).toEqual({
      grids: ['0 0 512 512', '0 0 512 512'],
      pixelLines: 15,
      icon: '64',
      centre: 'M256 0V512M0 256H512',
      padding: ['64', '384'],
    });
    expect(of(3)).toMatchObject({ grids: ['0 0 24 24', '0 0 24 24'], pixelLines: 23, padding: ['2', '20'] });
  });

  it('refuses an icon with neither a viewBox nor a grid', () => {
    expect(() => draw({ icons: [{ name: 'bare', svg: '<svg></svg>' }] })).toThrow(/bare/);
  });
});
