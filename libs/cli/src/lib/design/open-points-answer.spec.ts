import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { openPointsAnswer } from './system/open-points.fixtures';
import { createComment } from './system/comments/comment';
import { drawnFindingsOf } from './system/drawn-open-points';
import { oneProductOf } from './system/sketch/cli-args';
import { createSketch, decideSketch, markSketchReady, Sketch, variantDirOf } from './system/sketch/sketch';
import { ResolvedProduct } from './system/resolve-product';

vi.mock('./system/drawn-open-points', () => ({
  drawnFindingsOf: vi.fn(async () => ({
    missingStates: [{ part: 'components/chip', control: 'remove' }],
  })),
}));

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-open-points-answer-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part(
    'components/chip',
    "export default definePart({ implements: 'libs/chip.component.ts', controls: { remove: {} }, states: { default: {} } });\n",
  );
  part('pages/home', "export default definePart({ implements: { route: '/' }, states: { default: {} } });\n");
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

const ask = (target: string, path: string, method = 'GET') => ({
  target,
  url: new URL(`http://localhost${path}`),
  request: Object.assign(Readable.from([]), { method }) as unknown as IncomingMessage,
});

describe('openPointsAnswer', { timeout: 30_000 }, () => {
  it('answers the open points of every part, or of one, without a draw', async () => {
    const target = checkout();

    expect(await openPointsAnswer(ask(target, '/?product=app-a'))).toEqual({
      status: 200,
      body: {
        drawn: false,
        parts: [],
      },
    });
    expect(await openPointsAnswer(ask(target, '/?product=app-a&part=pages/home'))).toEqual({
      status: 200,
      body: {
        part: 'pages/home',
        hash: expect.any(String),
        ready: null,
        directEdit: false,
        buildReady: {
          ready: false,
          blockers: expect.arrayContaining([expect.objectContaining({ kind: 'no-harness' })]),
        },
        drawn: false,
        points: [],
      },
    });
    expect(drawnFindingsOf).not.toHaveBeenCalled();
  });

  it('answers a comment, a sketch and a part file edited between two calls', async () => {
    const target = checkout();
    const pointsOf = async (part = 'pages/home') => {
      const answer = await openPointsAnswer(ask(target, `/?product=app-a&part=${part}`));

      return (answer.body as { points: { kind: string }[] }).points.map((point) => point.kind);
    };
    const product = () => oneProductOf({ target, config: readConfig(target)!, asked: 'app-a' }) as ResolvedProduct;

    expect(await pointsOf()).toEqual([]);
    expect(await pointsOf()).toEqual([]);

    createComment({
      product: product(),
      comment: { part: 'pages/home', state: 'default', size: 'fitted', text: 'too tall' },
    });

    expect(await pointsOf()).toEqual(['open-comment']);

    createSketch({ product: product(), sketch: { layer: 'pages', name: 'home' }, variants: ['a'] });

    expect(await pointsOf()).toEqual(['open-comment', 'unmerged-sketch']);

    expect(await pointsOf('components/chip')).toEqual([]);

    writeFileSync(
      join(target, DESIGN_DIR, 'app-a/components/chip/chip.ts'),
      "export default definePart({ implements: 'libs/chip.component.ts', states: { default: {} } });\n",
    );

    expect(await pointsOf('components/chip')).toEqual(['missing-state']);
  });

  it('answers the pick point of a part that exists only in a ready sketch', async () => {
    const target = checkout();
    const product = oneProductOf({ target, config: readConfig(target)!, asked: 'app-a' }) as ResolvedProduct;
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'rating' }, variants: ['a', 'b'] });
    const ready = markSketchReady({ checkout: target, sketch: sketch as Sketch });

    decideSketch({
      sketch: ready as Sketch,
      decision: { kind: 'pick', variant: 'b', by: 'user', cmd: 'studio', pid: 1 },
    });

    const pick = { kind: 'unmerged-sketch', sketch: 'rating', primary: true, status: 'ready', decision: 'pick' };
    const one = await openPointsAnswer(ask(target, '/?product=app-a&part=elements/rating'));

    expect(one.status).toBe(200);
    expect((one.body as { points: unknown[] }).points).toEqual([pick]);
    expect(await openPointsAnswer(ask(target, '/?product=app-a'))).toEqual({
      status: 200,
      body: { drawn: false, parts: [{ part: 'elements/rating', points: [pick] }] },
    });
  });

  it('answers a sketch-problem point for each static rule problem a variant of a ready sketch brings in', async () => {
    const target = checkout();

    writeFileSync(join(target, DESIGN_DIR, 'app-a/styles.css'), "@import 'tailwindcss';\n");
    writeFileSync(
      join(target, DESIGN_DIR, 'config.json'),
      JSON.stringify({ products: { 'app-a': { styles: [`${DESIGN_DIR}/app-a/styles.css`] } } }),
    );

    const product = oneProductOf({ target, config: readConfig(target)!, asked: 'app-a' }) as ResolvedProduct;
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'rating' }, variants: ['a', 'b'] });
    const ready = markSketchReady({ checkout: target, sketch: sketch as Sketch }) as Sketch;

    writeFileSync(join(variantDirOf(ready, 'a'), 'elements/rating/rating.css'), '.rating { display: flex; }\n');

    const answer = await openPointsAnswer(ask(target, '/?product=app-a&part=elements/rating'));

    expect((answer.body as { points: unknown[] }).points).toContainEqual({
      kind: 'sketch-problem',
      sketch: 'rating',
      variant: 'a',
      rule: 'UTILITY-CSS',
      message: expect.stringContaining('display: flex'),
    });
    expect(
      (answer.body as { points: { kind: string; variant?: string }[] }).points.filter(
        (point) => point.kind === 'sketch-problem' && point.variant === 'b',
      ),
    ).toEqual([]);
  });

  it('draws one part for its missing control states', async () => {
    const answer = await openPointsAnswer(ask(checkout(), '/?product=app-a&part=components/chip&draw=true'));

    expect(answer).toEqual({
      status: 200,
      body: {
        part: 'components/chip',
        hash: expect.any(String),
        ready: null,
        directEdit: false,
        buildReady: {
          ready: false,
          blockers: expect.arrayContaining([
            expect.objectContaining({ kind: 'open-point' }),
            expect.objectContaining({ kind: 'no-harness' }),
          ]),
        },
        drawn: true,
        points: [{ kind: 'missing-state', control: 'remove' }],
      },
    });
  });

  it('refuses a bad parameter, an unknown part and a draw that cannot run', async () => {
    const target = checkout();
    const statusOf = async (path: string, method?: string) =>
      (await openPointsAnswer(ask(target, path, method))).status;

    expect(await statusOf('/')).toBe(400);
    expect(await statusOf('/?product=app-a&draw=true')).toBe(400);
    expect(await statusOf('/?product=app-a&part=pages/home&draw=yes')).toBe(400);
    expect(await statusOf('/?product=app-a&part=pages/gone')).toBe(404);
    expect(await statusOf('/?product=app-b')).toBe(404);
    expect(await statusOf('/?product=app-a', 'POST')).toBe(405);

    vi.mocked(drawnFindingsOf).mockResolvedValueOnce({ unavailable: 'no playwright' });

    expect(await openPointsAnswer(ask(target, '/?product=app-a&part=pages/home&draw=true'))).toEqual({
      status: 503,
      body: { error: 'cannot draw pages/home: no playwright' },
    });
  });
});
