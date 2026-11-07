import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { renderIssuesOf } from './render-check';

const skipWithoutBrowser = (context: { skip: (note?: string) => never }, reason: string) => {
  if (process.env['CI']) throw new Error(`No browser in CI: ${reason}`);

  return context.skip(reason);
};

const REACH_RULES = ['COVERED', 'UNREACHABLE'];

const checkout = (parts: Record<string, string | { body: string; setup: string }>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-reach-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { shop: { presets: { desktop: { width: 400, height: 300 } } } } }),
  );

  for (const [key, part] of Object.entries(parts)) {
    const [layer = '', name = ''] = key.split('/');
    const { body, setup } = typeof part === 'string' ? { body: part, setup: '[]' } : part;
    const dir = join(design, 'shop', layer, name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { default: {} },
  render: () => drawing({ body: html\`${body}\`, setup: ${setup} }),
});
`,
    );
  }

  return target;
};

const reachLinesOf = (issues: { rule: string; part: string; state: string; path: string; detail: string }[]) =>
  issues
    .filter((issue) => REACH_RULES.includes(issue.rule))
    .map((issue) => `${issue.rule} ${issue.part} ${issue.state}: ${issue.detail}`)
    .sort();

const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);
  vi.restoreAllMocks();
});

const pannable = (at: string) =>
  `<div data-canvas style="position: relative; width: 300px; height: 120px; overflow: hidden"><div data-world style="position: relative; width: 900px; height: 400px"><button data-et-action="emit:merge" style="position: absolute; ${at}">Übernehmen</button></div><header style="position: absolute; left: 0; top: 0; width: 300px; height: 40px; background: white">Kopf</header><span style="position: absolute; left: 0; top: 40px; width: 60px; height: 80px; background: white">a</span></div>`;

const panSetup = `[
  (root) => {
    const canvas = root.querySelector('[data-canvas]');
    const world = root.querySelector('[data-world]');
    const offset = { x: 0, y: 0 };
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      offset.x = Math.min(600, Math.max(0, offset.x + event.deltaX));
      offset.y = Math.min(280, Math.max(0, offset.y + event.deltaY));
      world.style.transform = 'translate(' + -offset.x + 'px, ' + -offset.y + 'px)';
    });
  },
]`;

describe('reach check', () => {
  it('flags a declared action that is hidden, faded, empty or buried, and any cover over it, also at camera pan positions', async (context) => {
    const take = (style = '') => `<button data-et-action="emit:merge" style="${style}">Übernehmen</button>`;
    const target = checkout({
      'components/reach-fine': `<div style="display: flex; gap: 8px">${take()}<button data-et-action="emit:discard">Verwerfen</button></div>`,
      'components/reach-hidden': `<div style="visibility: hidden">${take()}</div>`,
      'components/reach-gone': `<div><p>Row</p><div style="display: none">${take()}</div></div>`,
      'components/reach-attr-hidden': `<div><p>Row</p><div hidden>${take()}</div></div>`,
      'components/reach-faded': `<div style="opacity: 0">${take()}</div>`,
      'components/reach-empty': `<div><p>Row</p>${take('width: 0; height: 0; padding: 0; border: 0; overflow: hidden')}</div>`,
      'components/reach-inert': `<div inert style="visibility: hidden">${take()}</div>`,
      'components/reach-gutter': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<span style="position: absolute; left: 0; top: 0; width: 60px; height: 60px; background: white; pointer-events: none">name</span></div>`,
      'components/reach-skipped-cover': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<span data-et-skip="COVERED" style="position: absolute; left: 0; top: 0; width: 60px; height: 60px; background: white; pointer-events: none">name</span></div>`,
      'components/reach-badge': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<span aria-hidden="true" style="position: absolute; left: 0; top: 0; width: 20px; height: 20px; background: white; pointer-events: none">3</span></div>`,
      'components/reach-badge-click': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<span aria-hidden="true" style="position: absolute; left: 0; top: 0; width: 20px; height: 20px; background: white">3</span></div>`,
      'components/reach-dialog': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<div role="dialog" style="position: absolute; left: 0; top: 0; width: 40px; height: 60px; background: white">Hinweis</div></div>`,
      'components/reach-modal': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<section aria-modal="true" style="position: absolute; left: 0; top: 0; width: 40px; height: 60px; background: white">Hinweis</section></div>`,
      'components/reach-plain': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<div style="position: absolute; left: 0; top: 0; width: 40px; height: 60px; background: white">Hinweis</div></div>`,
      'components/reach-under': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<button data-et-action="emit:discard" style="position: absolute; left: 0; top: 0; width: 200px; height: 60px; background: transparent">Verwerfen</button></div>`,
      'components/reach-region': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px"></div><span style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: white">state</span></div>`,
      'components/reach-chrome': `<div style="position: relative; width: 300px; height: 100px"><div data-et-projected="canvas" style="width: 300px; height: 100px"></div><aside style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: white">panel</aside></div>`,
      'components/reach-preview': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px">${take()}</div><span style="position: absolute; left: 0; top: 0; width: 300px; height: 100px; background: white">state</span></div>`,
      'components/reach-region-menu': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px"></div><div role="menu" style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: white">menu</div></div>`,
      'components/reach-see-through': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<button data-et-action="emit:discard" style="position: absolute; left: 0; top: 0; width: 40px; height: 60px; background: transparent; border: 0">Verwerfen</button></div>`,
      'components/reach-pane': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<div style="position: absolute; left: 0; top: 0; width: 40px; height: 60px; background: white"><button data-et-action="emit:discard" style="width: 40px; height: 60px; background: transparent; border: 0">Verwerfen</button></div></div>`,
      'components/reach-pan-gutter': { body: pannable(`left: 400px; top: 40px`), setup: panSetup },
      'components/reach-pan-header': { body: pannable(`left: 100px; top: 160px`), setup: panSetup },
      'components/reach-translucent': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px"></div><span style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: rgb(255 255 255 / 0.5); pointer-events: none">state</span></div>`,
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(reachLinesOf(rendered.issues)).toEqual([
      'COVERED components/reach-badge-click default: "Übernehmen" (emit:merge): 3 of 9 points lie under the opaque div[data-et-part=components/reach-badge-click] > span',
      'COVERED components/reach-gutter default: "Übernehmen" (emit:merge): 6 of 9 points lie under the opaque div[data-et-part=components/reach-gutter] > span',
      'COVERED components/reach-pan-gutter default: "Übernehmen" (emit:merge): 3 of 9 points lie under the opaque div[data-et-part=components/reach-pan-gutter] > span when div[data-et-part=components/reach-pan-gutter] is panned 384px right',
      'COVERED components/reach-pan-header default: "Übernehmen" (emit:merge): 3 of 9 points lie under the opaque div[data-et-part=components/reach-pan-header] > header when div[data-et-part=components/reach-pan-header] is panned 128px down',
      'COVERED components/reach-pane default: "Übernehmen" (emit:merge): 3 of 9 points lie under the opaque div[data-et-part=components/reach-pane] > div',
      'COVERED components/reach-plain default: "Übernehmen" (emit:merge): 6 of 9 points lie under the opaque div[data-et-part=components/reach-plain] > div',
      'COVERED components/reach-preview default: the projected region "shot": 25 of 25 points lie under the opaque div[data-et-part=components/reach-preview] > span',
      'COVERED components/reach-region default: the projected region "shot": 5 of 25 points lie under the opaque div[data-et-part=components/reach-region] > span',
      'COVERED components/reach-see-through default: "Übernehmen" (emit:merge): 3 of 9 points lie under div[data-et-part=components/reach-see-through] > button:nth-of-type(2), which takes the click there',
      'UNREACHABLE components/reach-empty default: "Übernehmen" (emit:merge) is zero-size (0x0) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-faded default: "Übernehmen" (emit:merge) is invisible (opacity 0 on div[data-et-part=components/reach-faded]) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-gone default: "Übernehmen" (emit:merge) is not displayed (display: none on div[data-et-part=components/reach-gone] > div) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-hidden default: "Übernehmen" (emit:merge) is hidden (visibility: hidden) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-pan-gutter default: "Übernehmen" (emit:merge) is covered: a click at any point of it lands on div[data-et-part=components/reach-pan-gutter] > span when div[data-et-part=components/reach-pan-gutter] is panned 448px right',
      'UNREACHABLE components/reach-pan-header default: "Übernehmen" (emit:merge) is covered: a click at any point of it lands on div[data-et-part=components/reach-pan-header] > header when div[data-et-part=components/reach-pan-header] is panned 160px down',
      'UNREACHABLE components/reach-under default: "Übernehmen" (emit:merge) is covered: a click at any point of it lands on div[data-et-part=components/reach-under] > button:nth-of-type(2)',
    ]);
  }, 120_000);
});
