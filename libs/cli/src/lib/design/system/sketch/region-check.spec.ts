import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../design-config';
import { ShootStates } from '../compare-command';
import { Region } from '../region-geometry';
import { resolveProduct } from '../resolve-product';
import { sketchRegionCheckOf } from './region-check';
import { createSketch, Sketch } from './sketch';

const DESIGN = '.ethlete/design/acme';

const write = (file: string, content: string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const implementing = (file: string, component: string) =>
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace(/definePart(<\w+>)?\(\{/, (found) => `${found}\n  implements: '${component}',`),
  );

const liveAcme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-region-check-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const configFile = join(target, '.ethlete/design/config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8'));

  config.products.acme.harness = { app: 'app', map: 'app/map.ts', live: 'app/live.json' };
  writeFileSync(configFile, JSON.stringify(config));
  write(join(target, 'app/home.component.ts'), "@Component({ selector: 'app-home' }) export class Home {}");
  write(join(target, 'app/hero.component.ts'), "@Component({ selector: 'app-hero' }) export class Hero {}");
  write(
    join(target, 'app/live.json'),
    JSON.stringify({ host: 'app-root', pages: { 'pages/home': { states: { default: { design: 'default' } } } } }),
  );
  implementing(join(target, DESIGN, 'pages/home/home.ts'), 'app/home.component.ts');
  implementing(join(target, DESIGN, 'elements/hero/hero.ts'), 'app/hero.component.ts');

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'pages', name: 'home' }, variants: ['a'] }) as Sketch;

  return { target, product, sketch, config: readConfig(target) ?? {} };
};

const box = (height: number) => ({ x: 0, y: 40, width: 1280, height });

const heroOf = (height: number, clip = height): Region => ({
  name: 'elements/hero',
  box: box(height),
  clip: box(clip),
});

const shootWith =
  (design: Region, merged = heroOf(760)): ShootStates =>
  async ({ sketch }) => ({
    states: {},
    shots: [
      {
        state: 'default',
        design: Buffer.from(''),
        app: Buffer.from(''),
        regions: { design: [sketch ? design : merged], app: [heroOf(760)] },
      },
    ],
  });

const start = vi.fn(async () => ({ url: 'http://app', stop: async () => undefined }));

describe('sketchRegionCheckOf', () => {
  it('fails a variant whose embedded part box ends 20 px above the window bottom, naming the region and the delta', async () => {
    const { target, product, sketch, config } = liveAcme();

    const check = await sketchRegionCheckOf({ target, config, product, sketch, shoot: shootWith(heroOf(740)), start });

    expect(check).toEqual({
      lines: [
        'variant a default: REGION elements/hero box: height -20 px in the design (design 0,40 1280x740, app 0,40 1280x760)',
        'variant a default: REGION elements/hero clip: height -20 px in the design (design 0,40 1280x740, app 0,40 1280x760)',
      ],
      notes: [],
    });
  });

  it('fails a variant whose part box runs to the bottom but whose wrapper clips it 20 px short', async () => {
    const { target, product, sketch, config } = liveAcme();

    const check = await sketchRegionCheckOf({
      target,
      config,
      product,
      sketch,
      shoot: shootWith(heroOf(760, 740)),
      start,
    });

    expect(check.lines).toEqual([
      'variant a default: REGION elements/hero clip: height -20 px in the design (design 0,40 1280x740, app 0,40 1280x760)',
    ]);
  });

  it('passes the same variant with the box restored', async () => {
    const { target, product, sketch, config } = liveAcme();

    expect(
      await sketchRegionCheckOf({ target, config, product, sketch, shoot: shootWith(heroOf(760)), start }),
    ).toEqual({ lines: [], notes: [] });
  });

  it('passes a variant that keeps a drift the merged design already draws', async () => {
    const { target, product, sketch, config } = liveAcme();

    expect(
      (
        await sketchRegionCheckOf({
          target,
          config,
          product,
          sketch,
          shoot: shootWith(heroOf(740), heroOf(740)),
          start,
        })
      ).lines,
    ).toEqual([]);
  });

  it('skips a region whose part the variant holds: the variant claims to change it', async () => {
    const { target, product, sketch, config } = liveAcme();

    write(
      join(sketch.dir, 'a/elements/hero/hero.ts'),
      readFileSync(join(target, DESIGN, 'elements/hero/hero.ts'), 'utf8'),
    );

    expect(
      (await sketchRegionCheckOf({ target, config, product, sketch, shoot: shootWith(heroOf(740)), start })).lines,
    ).toEqual([]);
  });

  it('checks nothing for a page the live spec has no states of', async () => {
    const { target, product, sketch, config } = liveAcme();
    const shoot = vi.fn(shootWith(heroOf(740)));

    write(join(target, 'app/live.json'), JSON.stringify({ host: 'app-root', pages: {} }));

    expect(await sketchRegionCheckOf({ target, config, product, sketch, shoot, start })).toEqual({
      lines: [],
      notes: [],
    });
    expect(shoot).not.toHaveBeenCalled();
  });
});
