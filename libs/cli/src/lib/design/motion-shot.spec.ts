import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { pngSizeOf } from './contact-sheet';
import { designMotion } from './motion-command';
import { keyframeTimesOf } from './motion-shot';
import { DESIGN_DIR, readConfig } from './paths';
import { createDesignServer } from './serve';
import { createPartShooter } from './shot';
import { createSystemModules } from './system/system-modules';

const STYLES = [
  '.bar { width: 40px; height: 20px; background: rgb(0, 0, 0); transition: width 2000ms linear, background-color 1500ms ease-in; }',
  '.bar--open { width: 200px; }',
  '.bar--late { background: rgb(255, 0, 0); }',
  '@media (prefers-reduced-motion: reduce) { .bar { transition: background-color 1500ms ease-in; } }',
].join('\n');

const PART = `import { definePart, drawing } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { closed: { open: false }, open: { open: true } },
  motions: {
    grow: {
      from: 'closed',
      to: 'open',
      at: [300],
      play: (ctx) => ctx.at(1000, () => document.querySelector('.bar')?.classList.add('bar--late')),
    },
  },
  render: (state) =>
    drawing({ body: '<div class="bar' + (state.open ? ' bar--open' : '') + '"></div>', styles: ${JSON.stringify(STYLES)} }),
});
`;

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-motion-shot-'));
  const design = join(target, DESIGN_DIR);
  const dir = join(design, 'app-a', 'components', 'bar');

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  writeFileSync(join(dir, 'bar.ts'), PART);

  return { target, config: readConfig(target) ?? {} };
};

type Track = { kind: string; properties: string[]; start: number; duration: number; easing: string };

const isMissingBrowser = (error: unknown) => error instanceof Error && /chromium|playwright/i.test(error.message);

describe('keyframeTimesOf', () => {
  it('takes 0, 25, 50, 75 and 100 % of the end plus the at times, sorted and once each', () => {
    expect(keyframeTimesOf(400, [100, 250, -5])).toEqual([0, 100, 200, 250, 300, 400]);
  });
});

describe('createPartShooter motionOf', () => {
  it('steps a motion: CSS transitions and the ctx.at clock are drawn at each keyframe time', async (context) => {
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
      const motionOf = (mode: 'full' | 'reduced') =>
        shooter.motionOf({
          product: 'app-a',
          part: 'components/bar',
          state: 'closed',
          preset: null,
          width: null,
          sketch: null,
          interaction: null,
          motion: 'grow',
          at: [300],
          mode,
          params: new URLSearchParams(),
        });
      const full = await motionOf('full').catch((error: Error) => error);

      if (full instanceof Error && isMissingBrowser(full)) return context.skip(full.message);
      if (full instanceof Error) throw full;

      const reduced = await motionOf('reduced');
      const tracks = full.tracks as Track[];

      expect(full.end).toBe(2500);
      expect(full.keyframes.map((keyframe) => keyframe.ms)).toEqual([0, 300, 625, 1250, 1875, 2500]);
      expect(full.keyframes.map((keyframe) => pngSizeOf(keyframe.png).width)).toEqual([72, 96, 122, 172, 222, 232]);
      expect(tracks.map(({ kind, properties, start, duration }) => ({ kind, properties, start, duration }))).toEqual(
        expect.arrayContaining([
          { kind: 'transition', properties: ['width'], start: 0, duration: 2000 },
          { kind: 'transition', properties: ['background-color'], start: 1000, duration: 1500 },
        ]),
      );
      expect((reduced.tracks as Track[]).map((track) => track.properties)).toEqual([['background-color']]);
      expect(reduced.keyframes.map((keyframe) => pngSizeOf(keyframe.png).width)).toEqual([
        232, 232, 232, 232, 232, 232,
      ]);
    } finally {
      await shooter.close();
      await server.close();
    }
  }, 120_000);
});

describe('designMotion', () => {
  it('writes a sheet and the tracks of both modes, and names the motions a part has when one is unknown', async (context) => {
    const { target } = checkout();
    const out = join(target, 'grow.png');
    const errors: string[] = [];
    const error = console.error;
    const log = console.log;

    console.error = (...args: unknown[]) => errors.push(args.join(' '));
    console.log = () => undefined;

    try {
      const unknown = await designMotion({
        target,
        argv: ['shots', 'components/bar', 'fold'],
        invocation: 'et design',
      });

      expect(unknown).toBe(1);
      expect(errors.join('\n')).toContain('has no motion "fold" (motions: grow)');

      const code = await designMotion({
        target,
        argv: ['shots', 'components/bar', 'grow', '--out', out],
        invocation: 'et design',
      });

      if (code !== 0 && errors.some((line) => /chromium|playwright/i.test(line)))
        return context.skip(errors.join('\n'));

      expect(code).toBe(0);

      const report = JSON.parse(readFileSync(join(target, 'grow.json'), 'utf8')) as {
        from: string;
        to: string;
        modes: Record<string, { end: number; keyframes: number[] }>;
      };

      expect(report.from).toBe('closed');
      expect(report.to).toBe('open');
      expect(Object.keys(report.modes)).toEqual(['full', 'reduced']);
      expect(report.modes['full']?.keyframes).toEqual([0, 300, 625, 1250, 1875, 2500]);
      expect(pngSizeOf(readFileSync(out)).width).toBeGreaterThan(0);
    } finally {
      console.error = error;
      console.log = log;
    }
  }, 120_000);
});
