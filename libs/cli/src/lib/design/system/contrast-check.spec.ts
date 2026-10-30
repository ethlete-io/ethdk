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
  fading: {
    body: '<p class="fade" style="margin: 0">Fading in</p><style>.fade { transition: opacity 10s; } @starting-style { .fade { opacity: 0; } }</style>',
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
  it('measures each text against its composited background, to 4.5:1 or 3:1 for large text, after its animations', async (context) => {
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
      'components/composited default div[data-et-part=components/composited] > p - "Half" 3.95:1, needs 4.50:1',
      'components/composited other div[data-et-part=components/composited] > p - "Half" 3.95:1, needs 4.50:1',
      'components/enabled-label default div[data-et-part=components/enabled-label] > label - "Active" 1.61:1, needs 4.50:1',
      'components/enabled-label other div[data-et-part=components/enabled-label] > label - "Active" 1.61:1, needs 4.50:1',
      'components/helper default p[data-et-part=components/helper] - "Helper 4.48" 2.85:1, needs 4.50:1',
      'components/helper other p[data-et-part=components/helper] - "Helper 4.48" 2.85:1, needs 4.50:1',
      'components/large-low default p[data-et-part=components/large-low] - "Pale" 2.32:1, needs 3.00:1 (large text)',
      'components/large-low other p[data-et-part=components/large-low] - "Pale" 2.32:1, needs 3.00:1 (large text)',
      'components/low default p[data-et-part=components/low] - "Low" 4.48:1, needs 4.50:1',
      'components/low other p[data-et-part=components/low] - "Low" 4.48:1, needs 4.50:1',
      'components/no-reason - - - contrast exception {"selector":".mark","reason":""} needs a selector and a reason, for example { selector: \'.watermark\', reason: \'decorative\' }',
      'components/no-reason default div[data-et-part=components/no-reason] > span.mark - "Mark" 1.61:1, needs 4.50:1',
      'components/no-reason other div[data-et-part=components/no-reason] > span.mark - "Mark" 1.61:1, needs 4.50:1',
      'components/pairs default --ink on --paper - token pair 2.85:1, needs 4.50:1',
    ]);
  }, 120_000);
});
