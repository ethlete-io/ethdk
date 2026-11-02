import { uncoveredFindingLineOf, uncoveredFindingsOf } from './live-uncovered';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { DESIGN_DIR } from '../paths';
import { resolveProduct } from './resolve-product';
import { partCoverOf, RegionNode, uncoveredLineOf, uncoveredRegionsOf } from './uncovered-regions';

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

describe('partCoverOf', () => {
  let target = '';
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), text);
  };
  const component = (path: string, selector: string) =>
    write(path, `@Component({ selector: '${selector}', template: '' })\nexport class X {}\n`);

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'part-cover-'));
  });

  afterEach(() => rmSync(target, { recursive: true, force: true }));

  it('covers the components parts implement and the parts open sketches target, by link or else by name', () => {
    const product = join(DESIGN_DIR, 'app');

    component('apps/app/shell.component.ts', 'app-shell');
    component('apps/app/menu.component.ts', 'app-menu');
    write(
      join(product, 'elements/shell/shell.ts'),
      "export default definePart({ implements: 'apps/app/shell.component.ts', states: {} });\n",
    );
    write(join(product, 'components/tag/tag.ts'), 'export default definePart({ states: {} });\n');
    write(
      join(product, 'sketches/components-title-bar/sketch.json'),
      JSON.stringify({ target: 'components/title-bar', status: 'in progress' }),
    );
    write(
      join(product, 'sketches/components-title-bar/a/components/title-bar/title-bar.ts'),
      'export default definePart({ states: {} });\n',
    );
    write(
      join(product, 'sketches/elements-menu/sketch.json'),
      JSON.stringify({ target: 'elements/menu', status: 'in progress' }),
    );
    write(
      join(product, 'sketches/elements-menu/a/elements/menu/menu.ts'),
      "export default definePart({ implements: 'apps/app/menu.component.ts', states: {} });\n",
    );

    expect(partCoverOf({ target, product: resolveProduct({ target, name: 'app', config: {} }) })).toEqual({
      selectors: ['app-shell', 'app-menu'],
      names: ['title-bar'],
    });
  });
});
