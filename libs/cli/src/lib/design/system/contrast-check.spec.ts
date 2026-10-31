import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { renderIssuesOf } from './render-check';

const PARTS: Record<string, { body: string; extra?: string; setup?: string }> = {
  helper: {
    body: '<p style="margin: 0; color: #999">Helper</p><style>:root { --paper: #fff; }</style>',
    setup:
      "(root) => { const p = root.querySelector('p'); if (p) p.textContent = 'Helper ' + contrastRatioOf({ text: '#777', on: 'var(--paper)', within: root }).toFixed(2); }",
  },
  low: { body: '<p style="margin: 0; color: #777">Low</p>' },
  'large-ok': { body: '<p style="margin: 0; font-size: 24px; color: #777">Large</p>' },
  'bold-ok': { body: '<p style="margin: 0; font-size: 19px; font-weight: 700; color: #777">Bold</p>' },
  'large-low': { body: '<p style="margin: 0; font-size: 24px; color: #aaa">Pale</p>' },
  disabled: {
    body: '<div><button disabled style="color: #ccc">Off</button><span aria-disabled="true" style="color: #ccc">Gone</span></div>',
  },
  'disabled-labels': {
    body: '<div><label for="a" style="color: #ccc">By for</label><input id="a" disabled><label style="color: #ccc">Wrapping <input disabled></label><span id="l" style="color: #ccc">By aria</span><input aria-labelledby="l" aria-disabled="true"></div>',
  },
  'enabled-label': {
    body: '<div><label for="b" style="color: #ccc">Active</label><input id="b"></div>',
  },
  excepted: {
    body: '<div><span class="mark" style="color: #ccc">Mark</span></div>',
    extra: "contrast: { exceptions: [{ selector: '.mark', reason: 'decorative' }] },",
  },
  'no-reason': {
    body: '<div><span class="mark" style="color: #ccc">Mark</span></div>',
    extra: "contrast: { exceptions: [{ selector: '.mark', reason: '' }] },",
  },
  composited: {
    body: '<div style="background: #000"><p style="margin: 0; background: rgb(255 255 255 / 0.5); color: #fff">Half</p></div>',
  },
  underlay: {
    body: '<div style="position: relative; isolation: isolate; background: #fff"><span style="position: absolute; inset: 0; z-index: -1; background: #000"></span><span style="color: #fff">On fill</span></div>',
  },
  'pseudo-underlay': {
    body: '<div class="fill" style="background: #fff"><span style="color: #fff">On pseudo</span></div><style>.fill { position: relative; isolation: isolate; } .fill::before { content: ""; position: absolute; inset: 0; z-index: -1; background: #000; }</style>',
  },
  'underlay-low': {
    body: '<div style="position: relative; isolation: isolate; background: #fff"><span style="position: absolute; inset: 0; z-index: -1; background: #000"></span><span style="color: #333">Dim</span></div>',
  },
  fading: {
    body: '<p class="fade" style="margin: 0">Fading in</p><style>.fade { transition: opacity 10s; } @starting-style { .fade { opacity: 0; } }</style>',
  },
  'border-low': { body: '<button type="button" style="width: 40px; height: 20px; border: 1px solid #ccc"></button>' },
  'border-decorative': { body: '<div style="width: 40px; height: 20px; border: 1px solid #ccc"></div>' },
  'border-frame': {
    body: '<div style="padding: 4px; border: 1px solid #ccc"><input style="border: 0; outline: 0"></div>',
  },
  'border-separator': {
    body: '<aside style="padding: 8px; border-right: 1px solid #ccc"><header style="padding: 8px; border-bottom: 1px solid #ccc"><span>Inbox</span><button type="button" data-et-control="collapse" style="border: 0; background: none">Hide</button></header><footer style="padding: 8px; border-top: 1px solid #ccc"><button type="button" data-et-control="project" style="width: 100%; border: 0; background: none">Project</button></footer></aside>',
  },
  'border-panel': {
    body: '<section style="padding: 16px; border: 1px solid #ccc"><h3>Title</h3><p>Some text</p><div><input style="border: 0; outline: 0"></div></section>',
  },
  'page-fill': {
    body: '<p style="margin: 0; color: #222">On the fill</p>',
    setup: "(root) => { root.ownerDocument.body.style.backgroundImage = 'linear-gradient(#000, #000)'; }",
  },
  'border-toolbar': {
    body: '<div role="toolbar" style="display: flex; gap: 4px; padding: 4px; border: 1px solid #ccc"><button type="button" data-et-control="bold" style="border: 0; background: none">B</button><button type="button" data-et-control="italic" style="border: 0; background: none">I</button><button type="button" data-et-control="link" style="border: 0; background: none">L</button></div>',
  },
  'border-segmented': {
    body: '<div role="group" style="display: inline-flex; padding: 2px; border: 1px solid #ccc"><button type="button" data-et-control="day" style="width: 40px; height: 20px; border: 0; background: none">D</button><button type="button" data-et-control="week" style="width: 40px; height: 20px; border: 0; background: none">W</button><button type="button" data-et-control="month" style="width: 40px; height: 20px; border: 0; background: none">M</button></div>',
  },
  'border-ok': {
    body: '<button type="button" style="width: 40px; height: 20px; border: 1px solid #767676"></button>',
  },
  'border-filled': {
    body: '<button type="button" style="width: 40px; height: 20px; background: #000; border: 1px solid #222"></button>',
  },
  'border-transparent': {
    body: '<button type="button" style="width: 40px; height: 20px; border: 1px solid transparent"></button>',
  },
  'border-disabled': {
    body: '<div style="padding: 4px; border: 1px solid #ccc"><input disabled style="border: 1px solid #ccc"></div>',
  },
  'border-excepted': {
    body: '<div><button type="button" class="line" style="height: 20px; border-bottom: 1px solid #ccc"></button></div>',
    extra: "contrast: { exceptions: [{ selector: '.line', reason: 'decorative divider' }] },",
  },
  'icon-low': {
    body: '<svg width="16" height="16" style="color: #ccc"><path d="M0 0h16v16H0z" fill="currentColor"/></svg>',
  },
  'icon-stroke-low': {
    body: '<svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="#ddd" stroke-width="2"/></svg>',
  },
  'icon-decorative': {
    body: '<div><svg aria-hidden="true" width="200" height="40"><path d="M0 20h200" fill="none" stroke="#ddd" stroke-width="2"/></svg></div>',
  },
  'icon-in-control': {
    body: '<button type="button" style="border: 0; background: none"><svg aria-hidden="true" width="16" height="16"><path d="M0 0h16v16H0z" fill="#ddd"/></svg></button>',
  },
  'icon-ok': { body: '<svg width="16" height="16"><path d="M0 0h16v16H0z" fill="#555"/></svg>' },
  'icon-hidden': {
    body: '<div><svg width="16" height="16" style="opacity: 0"><path d="M0 0h16v16H0z" fill="#eee"/></svg></div>',
  },
  'icon-disabled': {
    body: '<div><button disabled><svg width="16" height="16"><path d="M0 0h16v16H0z" fill="#eee"/></svg></button></div>',
  },
  pairs: {
    body: '<p style="margin: 0">Tokens</p><style>:root { --ink: #999; --paper: #fff; --good: #000; }</style>',
    extra: "contrast: { pairs: [{ text: ['--ink', '--good'], on: ['--paper'] }] },",
  },
};

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-contrast-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { shop: {} } }));

  for (const [name, { body, extra = '', setup = 'undefined' }] of Object.entries(PARTS)) {
    const dir = join(design, 'shop', 'components', name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { contrastRatioOf, definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { default: {}, other: {} },
  ${extra}
  render: () => drawing({ body: html\`${body}\`, styles: '', setup: ${setup} }),
});
`,
    );
  }

  return target;
};

describe('contrast check', () => {
  it('measures each text against its composited background, to 4.5:1 or 3:1 for large text, and each border and icon to 3:1, after its animations', async (context) => {
    const target = checkout();
    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [{ product: 'shop', sketch: null, parts: null }],
    });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    const found = rendered.issues
      .filter((issue) => issue.rule === 'CONTRAST')
      .map((issue) => `${issue.part} ${issue.state} ${issue.path} - ${issue.detail.split(';')[0]}`)
      .sort();

    expect(found).toEqual([
      'components/border-frame default div[data-et-part=components/border-frame] - border 1.61:1, needs 3.00:1 (non-text)',
      'components/border-frame other div[data-et-part=components/border-frame] - border 1.61:1, needs 3.00:1 (non-text)',
      'components/border-low default button[data-et-part=components/border-low] - border 1.61:1, needs 3.00:1 (non-text)',
      'components/border-low other button[data-et-part=components/border-low] - border 1.61:1, needs 3.00:1 (non-text)',
      'components/border-segmented default div[data-et-part=components/border-segmented] - border 1.61:1, needs 3.00:1 (non-text)',
      'components/border-segmented other div[data-et-part=components/border-segmented] - border 1.61:1, needs 3.00:1 (non-text)',
      'components/composited default div[data-et-part=components/composited] > p - "Half" 3.95:1, needs 4.50:1',
      'components/composited other div[data-et-part=components/composited] > p - "Half" 3.95:1, needs 4.50:1',
      'components/enabled-label default div[data-et-part=components/enabled-label] > label - "Active" 1.61:1, needs 4.50:1',
      'components/enabled-label other div[data-et-part=components/enabled-label] > label - "Active" 1.61:1, needs 4.50:1',
      'components/helper default p[data-et-part=components/helper] - "Helper 4.48" 2.85:1, needs 4.50:1',
      'components/helper other p[data-et-part=components/helper] - "Helper 4.48" 2.85:1, needs 4.50:1',
      'components/icon-in-control default button[data-et-part=components/icon-in-control] > svg - icon 1.36:1, needs 3.00:1 (non-text)',
      'components/icon-in-control other button[data-et-part=components/icon-in-control] > svg - icon 1.36:1, needs 3.00:1 (non-text)',
      'components/icon-low default svg[data-et-part=components/icon-low] - icon 1.61:1, needs 3.00:1 (non-text)',
      'components/icon-low other svg[data-et-part=components/icon-low] - icon 1.61:1, needs 3.00:1 (non-text)',
      'components/icon-stroke-low default svg[data-et-part=components/icon-stroke-low] - icon 1.36:1, needs 3.00:1 (non-text)',
      'components/icon-stroke-low other svg[data-et-part=components/icon-stroke-low] - icon 1.36:1, needs 3.00:1 (non-text)',
      'components/large-low default p[data-et-part=components/large-low] - "Pale" 2.32:1, needs 3.00:1 (large text)',
      'components/large-low other p[data-et-part=components/large-low] - "Pale" 2.32:1, needs 3.00:1 (large text)',
      'components/low default p[data-et-part=components/low] - "Low" 4.48:1, needs 4.50:1',
      'components/low other p[data-et-part=components/low] - "Low" 4.48:1, needs 4.50:1',
      'components/no-reason - - - contrast exception {"selector":".mark","reason":""} needs a selector and a reason, for example { selector: \'.watermark\', reason: \'decorative\' }',
      'components/no-reason default div[data-et-part=components/no-reason] > span.mark - "Mark" 1.61:1, needs 4.50:1',
      'components/no-reason other div[data-et-part=components/no-reason] > span.mark - "Mark" 1.61:1, needs 4.50:1',
      'components/page-fill default p[data-et-part=components/page-fill] - "On the fill" 1.32:1, needs 4.50:1',
      'components/page-fill other p[data-et-part=components/page-fill] - "On the fill" 1.32:1, needs 4.50:1',
      'components/pairs default --ink on --paper - token pair 2.85:1, needs 4.50:1',
      'components/underlay-low default div[data-et-part=components/underlay-low] > span:nth-of-type(2) - "Dim" 1.66:1, needs 4.50:1',
      'components/underlay-low other div[data-et-part=components/underlay-low] > span:nth-of-type(2) - "Dim" 1.66:1, needs 4.50:1',
    ]);
  }, 120_000);
});
