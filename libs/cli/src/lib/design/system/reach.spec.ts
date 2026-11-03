import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { renderIssuesOf } from './render-check';

const skipWithoutBrowser = (context: { skip: (note?: string) => never }, reason: string) => {
  if (process.env['CI']) throw new Error(`No browser in CI: ${reason}`);

  return context.skip(reason);
};

const REACH_RULES = ['COVERED', 'UNREACHABLE'];

const checkout = (parts: Record<string, string>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-reach-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { shop: { presets: { desktop: { width: 400, height: 300 } } } } }),
  );

  for (const [key, body] of Object.entries(parts)) {
    const [layer = '', name = ''] = key.split('/');
    const dir = join(design, 'shop', layer, name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { default: {} },
  render: () => drawing({ body: html\`${body}\` }),
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

describe('reach check', () => {
  it('flags a declared action that is hidden, faded, empty or buried, and an opaque cover over it', async (context) => {
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
      'components/reach-under': `<div style="position: relative; width: 300px; height: 60px">${take('position: absolute; left: 0; top: 0')}<button data-et-action="emit:discard" style="position: absolute; left: 0; top: 0; width: 200px; height: 60px; background: transparent">Verwerfen</button></div>`,
      'components/reach-region': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px"></div><span style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: white">state</span></div>`,
      'components/reach-chrome': `<div style="position: relative; width: 300px; height: 100px"><div data-et-projected="canvas" style="width: 300px; height: 100px"></div><aside style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: white">panel</aside></div>`,
      'components/reach-preview': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px">${take()}</div><span style="position: absolute; left: 0; top: 0; width: 300px; height: 100px; background: white">state</span></div>`,
      'components/reach-region-menu': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px"></div><div role="menu" style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: white">menu</div></div>`,
      'components/reach-translucent': `<div data-et-projected="canvas" style="position: relative; width: 300px; height: 100px"><div data-et-projected="shot" style="width: 300px; height: 100px"></div><span style="position: absolute; left: 0; top: 0; width: 80px; height: 100px; background: rgb(255 255 255 / 0.5); pointer-events: none">state</span></div>`,
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(reachLinesOf(rendered.issues)).toEqual([
      'COVERED components/reach-gutter default: "Übernehmen" (emit:merge): 6 of 9 points lie under the opaque div[data-et-part=components/reach-gutter] > span',
      'COVERED components/reach-preview default: the projected region "shot": 25 of 25 points lie under the opaque div[data-et-part=components/reach-preview] > span',
      'COVERED components/reach-region default: the projected region "shot": 5 of 25 points lie under the opaque div[data-et-part=components/reach-region] > span',
      'UNREACHABLE components/reach-empty default: "Übernehmen" (emit:merge) is zero-size (0x0) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-faded default: "Übernehmen" (emit:merge) is invisible (opacity 0 on div[data-et-part=components/reach-faded]) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-gone default: "Übernehmen" (emit:merge) is not displayed (display: none on div[data-et-part=components/reach-gone] > div) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-hidden default: "Übernehmen" (emit:merge) is hidden (visibility: hidden) in a state that declares it, so it can not be pressed',
      'UNREACHABLE components/reach-under default: "Übernehmen" (emit:merge) is covered: a click at any point of it lands on div[data-et-part=components/reach-under] > button:nth-of-type(2)',
    ]);
  }, 120_000);
});
