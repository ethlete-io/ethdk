import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { pngSizeOf } from './contact-sheet';
import { designMotion } from './motion-command';
import { flowLineOf } from './motion-flow';
import { DESIGN_DIR, readConfig } from './paths';
import { createDesignServer } from './serve';
import { createPartShooter } from './shot';
import { DesignFlow, FlowLine } from './system/flows/flow';
import { createSystemModules } from './system/system-modules';

const list = { part: 'pages/list', state: 'rest' };
const detail = { part: 'pages/detail', state: 'rest' };
const settings = { part: 'pages/settings', state: 'rest' };

const flowOf = (lines: FlowLine[]): DesignFlow => ({
  name: 'browse',
  file: 'browse.json',
  frames: [],
  lines,
  notes: [],
});

describe('flowLineOf', () => {
  it('finds a line by its id, else by from→to, and only when it animates', () => {
    const open: FlowLine = { from: list, to: detail, id: 'open', transition: 'view' };
    const back: FlowLine = { from: detail, to: list, transition: 'view' };
    const still: FlowLine = { from: list, to: settings };
    const flow = flowOf([open, back, still]);

    expect(flowLineOf(flow, 'open')).toBe(open);
    expect(flowLineOf(flow, 'pages/detail#rest→pages/list#rest')).toBe(back);
    expect(flowLineOf(flow, 'pages/detail#rest -> pages/list#rest')).toBe(back);
    expect(flowLineOf(flow, 'pages/list#rest→pages/detail#rest')).toContain('has the id "open"');
    expect(flowLineOf(flow, 'pages/list#rest→pages/settings#rest')).toContain('does not animate');
    expect(flowLineOf(flow, '1')).toContain('animated lines: open, pages/detail#rest→pages/list#rest');
    expect(flowLineOf(flowOf([back, back]), 'pages/detail#rest→pages/list#rest')).toContain('has 2 lines');
  });
});

const pageOf = (styles: string) => `import { definePart, drawing } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { rest: {} },
  render: () => drawing({ body: '<div class="page"></div>', styles: ${JSON.stringify(styles)} }),
});
`;

const LIST_STYLES = 'body { margin: 0; } .page { height: 600px; background: rgb(255, 0, 0); }';

const DETAIL_STYLES = [
  '.page { height: 600px; background: rgb(0, 0, 255); }',
  '::view-transition-old(root), ::view-transition-new(root) { animation-duration: 800ms; animation-timing-function: linear; }',
].join('\n');

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-motion-flow-'));
  const design = join(target, DESIGN_DIR);
  const product = join(design, 'app-a');

  for (const [name, styles] of [
    ['list', LIST_STYLES],
    ['detail', DETAIL_STYLES],
  ] as const) {
    mkdirSync(join(product, 'pages', name), { recursive: true });
    writeFileSync(join(product, 'pages', name, `${name}.ts`), pageOf(styles));
  }

  mkdirSync(join(product, 'flows'), { recursive: true });
  writeFileSync(
    join(product, 'flows', 'browse.json'),
    JSON.stringify({ frames: [list, detail], lines: [{ from: list, to: detail, id: 'open', transition: 'view' }] }),
  );
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { 'app-a': { presets: { phone: { width: 400, height: 300 } } } } }),
  );

  return { target, config: readConfig(target) ?? {} };
};

const isMissingBrowser = (error: unknown) => error instanceof Error && /chromium|playwright/i.test(error.message);

type Track = { element: string; duration: number };

describe('motion flow', () => {
  it('morphs the from page to the to page in a View Transition with the to page styles, in the preset viewport', async (context) => {
    const { target, config } = checkout();
    const server = await createDesignServer({ target, config, listen: true, port: 0 });

    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const shooter = createPartShooter({
      target,
      base: `http://localhost:${port}`,
      system: createSystemModules({ target, config }),
    });

    try {
      const drawn = await shooter
        .motionOf({
          ...list,
          product: 'app-a',
          preset: 'phone',
          width: null,
          sketch: null,
          interaction: null,
          motion: 'open',
          flowTo: detail,
          mode: 'full',
          params: new URLSearchParams(),
        })
        .catch((error: Error) => error);

      if (drawn instanceof Error && isMissingBrowser(drawn)) return context.skip(drawn.message);
      if (drawn instanceof Error) throw drawn;

      expect(drawn.end).toBe(800);
      expect(drawn.keyframes.map((keyframe) => keyframe.ms)).toEqual([0, 200, 400, 600, 800]);
      expect(
        new Set(
          (drawn.tracks as Track[])
            .filter((track) => track.element.includes('::view-transition-new(root)'))
            .map((track) => track.duration),
        ),
      ).toEqual(new Set([800]));
      expect(drawn.keyframes[0]?.png.equals(drawn.keyframes[4]?.png ?? Buffer.alloc(0))).toBe(false);
      expect(drawn.keyframes.map((keyframe) => pngSizeOf(keyframe.png))).toEqual(
        Array.from({ length: 5 }, () => ({ width: 400, height: 300 })),
      );
    } finally {
      await shooter.close();
      await server.close();
    }

    const errors: string[] = [];
    const error = console.error;
    const log = console.log;

    console.error = (...args: unknown[]) => errors.push(args.join(' '));
    console.log = () => undefined;

    try {
      expect(await designMotion({ target, argv: ['flow', 'browse', '0'], invocation: 'et design' })).toBe(1);
      expect(errors.join('\n')).toContain('flow "browse" has no line "0" (animated lines: open)');

      const out = join(target, 'open.png');

      expect(
        await designMotion({
          target,
          argv: ['flow', 'browse', 'open', '--mode', 'full', '--out', out],
          invocation: 'et design',
        }),
      ).toBe(0);

      const report = JSON.parse(readFileSync(join(target, 'open.json'), 'utf8')) as {
        line: string;
        from: string;
        to: string;
        preset: string;
        modes: Record<string, { end: number }>;
      };

      expect(report).toMatchObject({
        line: 'open',
        from: 'pages/list#rest',
        to: 'pages/detail#rest',
        preset: 'phone',
        modes: { full: { end: 800 } },
      });
    } finally {
      console.error = error;
      console.log = log;
    }
  }, 120_000);
});
