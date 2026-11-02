import { uncoveredFindingLineOf, uncoveredFindingsOf } from './live-uncovered';
import { RegionNode, uncoveredLineOf, uncoveredRegionsOf } from './uncovered-regions';

const node = (
  tag: string,
  box: [number, number, number, number],
  options: Partial<Pick<RegionNode, 'className' | 'covered' | 'paints' | 'children'>> = {},
): RegionNode => ({
  tag,
  className: options.className ?? '',
  box: { x: box[0], y: box[1], width: box[2], height: box[3] },
  covered: options.covered ?? false,
  paints: options.paints ?? false,
  children: options.children ?? [],
});

const titleBar = node('app-title-bar', [0, 0, 800, 36], {
  className: 'block',
  children: [node('button', [760, 6, 24, 24], { paints: true })],
});
const shell = node('app-shell', [0, 36, 800, 564], { covered: true });

describe('uncoveredRegionsOf', () => {
  it('reports a painted subtree beside the part components and descends through the wrappers that hold parts', () => {
    const tree = node('body', [0, 0, 800, 600], {
      paints: true,
      children: [
        node('app-root', [0, 0, 800, 600], {
          children: [node('div', [0, 0, 800, 600], { children: [titleBar, shell] })],
        }),
      ],
    });

    expect(uncoveredRegionsOf(tree)).toEqual([
      {
        element: '<app-title-bar class="block">',
        component: 'app-title-bar',
        box: { x: 0, y: 0, width: 800, height: 36 },
      },
    ]);
  });

  it('passes a page whose every painted region lies inside a part', () => {
    const tree = node('body', [0, 0, 800, 600], {
      children: [shell, node('div', [0, 0, 800, 36], { children: [node('span', [0, 0, 80, 20])] })],
    });

    expect(uncoveredRegionsOf(tree)).toEqual([]);
  });

  it('ignores regions smaller than the minimum side and names the component a plain element sits in', () => {
    const tree = node('body', [0, 0, 800, 600], {
      children: [
        node('app-page', [0, 0, 800, 600], {
          children: [
            shell,
            node('hr', [0, 36, 800, 1], { paints: true }),
            node('p', [8, 40, 200, 20], { paints: true }),
          ],
        }),
      ],
    });

    expect(uncoveredRegionsOf(tree)).toEqual([
      { element: '<p>', component: 'app-page', box: { x: 8, y: 40, width: 200, height: 20 } },
    ]);
  });

  it('looks inside a zero-size wrapper such as display: contents', () => {
    const tree = node('body', [0, 0, 800, 600], {
      children: [shell, node('app-wrap', [0, 0, 0, 0], { children: [node('div', [0, 0, 100, 50], { paints: true })] })],
    });

    expect(uncoveredRegionsOf(tree)).toEqual([
      { element: '<div>', component: 'app-wrap', box: { x: 0, y: 0, width: 100, height: 50 } },
    ]);
  });

  it('reports the whole page when no part is on it', () => {
    expect(uncoveredRegionsOf(node('body', [0, 0, 800, 600.4], { paints: true }))).toEqual([
      { element: '<body>', component: null, box: { x: 0, y: 0, width: 800, height: 600 } },
    ]);
  });
});

describe('uncovered report lines', () => {
  const region = {
    element: '<div class="bar">',
    component: 'app-title-bar',
    box: { x: 0, y: 0, width: 800, height: 36 },
  };

  it('names the element, its component and its box, and how to resolve the finding', () => {
    expect(uncoveredLineOf(region, 'http://app/')).toBe(
      'UNCOVERED: <div class="bar"> in <app-title-bar> at 0,0 800x36 on http://app/ - no part covers this visible app region; add a part that implements its component, or list it under "partless" in the live spec with a reason if it stays undesigned',
    );
  });

  it('groups one region over every live state that shows it', () => {
    const other = { ...region, element: '<p>' };
    const findings = uncoveredFindingsOf([
      { state: 'pages/a one', regions: [region] },
      { state: 'pages/a two', regions: [region, other] },
    ]);

    expect(findings.map(uncoveredFindingLineOf)).toEqual([
      'UNCOVERED: <div class="bar"> in <app-title-bar> at 0,0 800x36 in pages/a one, pages/a two',
      'UNCOVERED: <p> in <app-title-bar> at 0,0 800x36 in pages/a two',
    ]);
  });
});
