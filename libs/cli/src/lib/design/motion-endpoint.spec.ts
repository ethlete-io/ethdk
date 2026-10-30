import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { MotionAnswer } from './motion-endpoint';
import * as motionShot from './motion-shot';
import { DESIGN_DIR, readConfig } from './paths';
import { createDesignServer } from './serve';
import { MOTION_PATH } from './studio-api';

vi.mock('./motion-shot', async (original) => {
  const actual = await original<typeof motionShot>();

  return { ...actual, motionPicturesOf: vi.fn(actual.motionPicturesOf) };
});

const PART = `import { definePart, drawing } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { closed: { open: false }, open: { open: true } },
  motions: { grow: { from: 'closed', to: 'open', at: [100] } },
  render: (state) =>
    drawing({
      body: '<div class="bar' + (state.open ? ' bar--open' : '') + '"></div>',
      styles: '.bar { width: 40px; height: 20px; background: rgb(0, 0, 0); transition: width 400ms linear; } .bar--open { width: 120px; }',
    }),
});
`;

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-motion-endpoint-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a', 'components', 'bar'), { recursive: true });
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  writeFileSync(join(design, 'app-a', 'components', 'bar', 'bar.ts'), PART);

  return { target, config: readConfig(target) ?? {} };
};

const isMissingBrowser = (text: string) => /chromium|playwright/i.test(text);

describe(MOTION_PATH, () => {
  it('answers the keyframes and tracks of one mode, serves each keyframe image from one cached draw', async (context) => {
    const { target, config } = checkout();
    const server = await createDesignServer({ target, config, listen: true, port: 0 });

    await server.listen();

    const { port, address, family } = server.httpServer?.address() as AddressInfo;
    const origin = `http://${family === 'IPv6' ? `[${address}]` : address}:${port}`;
    const get = (query: string) => fetch(`${origin}${MOTION_PATH}?${query}`);
    const drawn = vi.mocked(motionShot.motionPicturesOf);

    drawn.mockClear();

    try {
      const first = await get('product=app-a&part=components/bar&motion=grow');

      if (first.status !== 200) {
        const text = await first.text();

        if (isMissingBrowser(text)) return context.skip(text);

        throw new Error(text);
      }

      const answer = (await first.json()) as MotionAnswer;

      expect(answer).toMatchObject({
        product: 'app-a',
        part: 'components/bar',
        motion: 'grow',
        from: 'closed',
        to: 'open',
        mode: 'full',
        preset: null,
        width: null,
        end: 400,
      });
      expect(answer.keyframes.map((keyframe) => keyframe.ms)).toEqual([0, 100, 200, 300, 400]);
      expect(answer.tracks).toHaveLength(1);

      const frame = await fetch(`${origin}${answer.keyframes[2]?.src}`);

      expect(frame.status).toBe(200);
      expect(frame.headers.get('content-type')).toBe('image/png');
      expect(
        Buffer.from(await frame.arrayBuffer())
          .subarray(1, 4)
          .toString(),
      ).toBe('PNG');
      expect(drawn).toHaveBeenCalledTimes(1);

      const reduced = (await (
        await get('product=app-a&part=components/bar&motion=grow&mode=reduced')
      ).json()) as MotionAnswer;

      expect(reduced.mode).toBe('reduced');
      expect(drawn).toHaveBeenCalledTimes(2);

      expect((await get('product=app-a&part=components/bar&motion=grow&frame=150')).status).toBe(404);
      expect(await (await get('product=app-a&part=components/bar&motion=shrink')).text()).toContain(
        'has no motion "shrink" (motions: grow)',
      );
      expect((await get('product=app-a&part=components/bar')).status).toBe(400);
      expect((await get('product=app-a&part=components/nope&motion=grow')).status).toBe(404);
    } finally {
      await server.close();
    }
  }, 120_000);
});
