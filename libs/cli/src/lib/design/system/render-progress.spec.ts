import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { inspectRetryingTimeouts, RenderIssue, renderIssuesOf } from './render-check';

const checkout = (bodyOf: (name: string) => string = () => '<p style="margin: 0; color: #000">Text</p>') => {
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
  render: () => drawing({ body: html\`${bodyOf(name)}\`, styles: '' }),
});
`,
    );
  }

  return target;
};

const render = (options: { partTimeoutMs?: number }, bodyOf?: (name: string) => string) => {
  const target = checkout(bodyOf);
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

  it('reports a part that does not finish in time, also alone, as RENDER-TIMEOUT and goes on with the next', async (context) => {
    const { rendered, lines } = await render({ partTimeoutMs: 1 });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    const timeouts = rendered.issues.filter((issue) => issue.rule === 'RENDER-TIMEOUT').map((issue) => issue.part);

    expect(timeouts).toEqual(['components/one', 'components/two']);
    expect(rendered.issues[0]?.detail).toContain('did not finish within');
    expect(lines).toHaveLength(2);
  }, 120_000);

  it('draws a part that timed out once more alone and keeps that answer', async () => {
    const frame = (part: string) => ({ address: { product: 'shop', part, sketch: null } }) as never;
    const timeout = { rule: 'RENDER-TIMEOUT', product: 'shop', part: 'components/one', sketch: null } as RenderIssue;
    const other = { ...timeout, rule: 'CONTRAST', part: 'components/two' };
    const calls: string[][] = [];
    const inspectOf = async (options: { frames: { address: { part: string } }[] }) => {
      calls.push(options.frames.map((each) => each.address.part));

      return calls.length === 1 ? [timeout, other] : [];
    };

    const issues = await inspectRetryingTimeouts({
      browser: null as never,
      base: '',
      frames: [frame('components/one'), frame('components/two')],
      inspectOf: inspectOf as never,
    });

    expect(calls).toEqual([['components/one', 'components/two'], ['components/one']]);
    expect(issues).toEqual([other]);
  });

  it('reports an SDK error a part logs on that part and lets other errors pass', async (context) => {
    const logging = (message: string) => `<img src="x" onerror="console.error(${message})">`;
    const { rendered } = await render({}, (name) =>
      name === 'one'
        ? logging("'ET123: Something broke' + String.fromCharCode(10) + 'second line'")
        : logging("'plain failure'"),
    );

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    const logged = rendered.issues.filter((issue) => issue.detail.includes('SDK error'));

    expect(logged.map((issue) => issue.part)).toEqual(['components/one']);
    expect(logged[0]?.rule).toBe('RENDER');
    expect(logged[0]?.detail).toContain('ET123: Something broke');
    expect(logged[0]?.detail).not.toContain('second line');
  }, 120_000);
});
