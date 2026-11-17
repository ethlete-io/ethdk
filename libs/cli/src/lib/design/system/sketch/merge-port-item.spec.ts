import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { gitSpawn } from '../../../git-test-env.fixtures';
import { resolveProduct } from '../resolve-product';
import { originOf } from '../write-origin';
import { writePartRecord } from '../part-ready';
import { designTask } from '../task-command';
import { mergeStepOf } from './merge-step';
import { studioMergeOf } from './merge-runner';
import { createSketch, decideSketch, markSketchReady, Sketch } from './sketch';

const BY = 'claude-opus-5-5';
const COMPONENT = 'apps/acme/src/hero.component.ts';

const acmeOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const implementedHero = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-port-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');
  mkdirSync(join(target, 'apps/acme/src'), { recursive: true });
  writeFileSync(
    join(target, COMPONENT),
    "@Component({ selector: 'acme-hero' })\nexport class Hero {\n  film = input.required<unknown>();\n}\n",
  );

  const heroTs = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

  writeFileSync(
    heroTs,
    readFileSync(heroTs, 'utf8').replace(
      'definePart<HeroProps>({',
      `definePart<HeroProps>({\n  implements: '${COMPONENT}',`,
    ),
  );

  const git = (...args: string[]) =>
    gitSpawn(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' });

  git('init');
  git('add', '.');
  git('commit', '-m', 'base');

  const created = createSketch({
    product: acmeOf(target),
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a'],
  }) as Sketch;
  const variantTs = join(created.dir, 'a', 'elements/hero/hero.ts');

  writeFileSync(
    variantTs,
    readFileSync(variantTs, 'utf8')
      .replace('{ film: Film }', '{ film: Film; withdrawn?: boolean }')
      .replace('describe: { default:', "describe: { withdrawn: 'A withdrawn film; check the marker.', default:")
      .replace(
        "states: { default: { film: films[0] ?? { title: '' } } },",
        "states: {\n    default: { film: films[0] ?? { title: '' }, withdrawn: false },\n    withdrawn: { film: films[0] ?? { title: '' }, withdrawn: true },\n  },",
      ),
  );

  const sketch = markSketchReady({ checkout: target, sketch: created }) as Sketch;

  return { target, sketch };
};

describe('merge of a sketch that adds a prop the app component has no input for', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints a PORT item naming the part, the component and the prop', async () => {
    const logged: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => void logged.push(String(line)));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { target } = implementedHero();
    const step = mergeStepOf({ target, product: 'acme', part: 'elements/hero', variant: 'a', note: 'Q1', by: BY });

    if (typeof step === 'string') throw new Error(step);

    expect(await step.run()).toBe(0);
    expect(logged.filter((line) => line.startsWith('PORT '))).toEqual([
      `PORT acme elements/hero: the merged design states send withdrawn - ${COMPONENT} has no input for it; add the input, see design task elements/hero --product acme`,
    ]);
  });

  it('lists the prop on the port line of design task after a Studio merge', async () => {
    const logged: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => void logged.push(String(line)));
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void logged.push(String(line)));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { target, sketch } = implementedHero();
    const picked = decideSketch({
      sketch,
      decision: { kind: 'pick', variant: 'a', ...originOf('designer') },
    }) as Sketch;

    expect(studioMergeOf({ target, product: 'acme', sketch: picked })).toEqual(['elements/hero']);

    const configFile = join(target, DESIGN_DIR, 'config.json');
    const config = JSON.parse(readFileSync(configFile, 'utf8'));

    config.products.acme.harness = { app: 'apps/acme', map: 'apps/acme/harness.ts' };
    writeFileSync(configFile, JSON.stringify(config));
    for (const part of ['components/button', 'elements/hero'])
      writePartRecord({ product: acmeOf(target), part, origin: originOf('spec') });
    logged.length = 0;
    await designTask({
      target,
      argv: ['elements/hero', '--product', 'acme'],
      invocation: 'et design',
      inputs: () => ({ pointsOf: () => [], problemsOf: () => [], slowOf: () => [] }),
    });

    expect(logged.join('\n')).toContain(`port: no input on ${COMPONENT} for withdrawn`);
  });
});
