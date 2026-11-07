import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { renderIssuesOf } from './render-check';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-unchanged-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { shop: {} } }));

  for (const name of ['one', 'two']) {
    const dir = join(design, 'shop', 'components', name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { default: {}, other: {} },
  render: () => drawing({ body: html\`<p style="margin: 0; color: #000">Text</p>\`, styles: '' }),
});
`,
    );
  }

  return target;
};

describe('render check of unchanged states', () => {
  it('inspects no frame of a state the job names unchanged', async (context) => {
    const target = checkout();
    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [{ product: 'shop', sketch: null, parts: null, unchanged: { 'components/one': ['default', 'other'] } }],
    });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(rendered.drawn.map(({ part, state }) => `${part} ${state}`)).toEqual([
      'components/two default',
      'components/two other',
    ]);
  }, 120_000);
});
