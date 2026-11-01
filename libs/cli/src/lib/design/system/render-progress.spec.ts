import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { renderIssuesOf } from './render-check';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-progress-'));
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

const render = (options: { partTimeoutMs?: number }) => {
  const target = checkout();
  const lines: string[] = [];

  return renderIssuesOf({
    target,
    config: readConfig(target) ?? {},
    jobs: [{ product: 'shop', sketch: null, parts: null }],
    onProgress: (line) => lines.push(line),
    ...options,
  }).then((rendered) => ({ rendered, lines }));
};

describe('render check progress', () => {
  it('prints one line per rendered part with its position and seconds', async (context) => {
    const { rendered, lines } = await render({});

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[1\/2\] components\/one \d+s$/);
    expect(lines[1]).toMatch(/^\[2\/2\] components\/two \d+s$/);
  }, 120_000);

  it('reports a part that does not finish in time as a RENDER issue and goes on with the next', async (context) => {
    const { rendered, lines } = await render({ partTimeoutMs: 1 });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    const timeouts = rendered.issues.filter((issue) => issue.rule === 'RENDER').map((issue) => issue.part);

    expect(timeouts).toEqual(['components/one', 'components/two']);
    expect(rendered.issues[0]?.detail).toContain('did not finish within');
    expect(lines).toHaveLength(2);
  }, 120_000);
});
