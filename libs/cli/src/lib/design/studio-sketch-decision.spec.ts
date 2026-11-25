import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { designSketch } from './sketch-command';
import { sketchApproveAnswer, sketchDecisionAnswer, sketchesAnswer } from './studio-api';
import { resolveProduct } from './system/resolve-product';
import { createSketch, findSketch, markSketchReady, parseTarget } from './system/sketch/sketch';

const readied = (beforeReady?: (sketchDir: string) => void) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-studio-pick-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const parsed = parseTarget('elements/hero');

  if (typeof parsed === 'string') throw new Error(parsed);

  const created = createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

  if (typeof created === 'string') throw new Error(created);

  const sketchDir = join(target, DESIGN_DIR, 'acme/sketches/elements-hero');

  beforeReady?.(sketchDir);
  markSketchReady({ checkout: target, sketch: beforeReady ? readSketchAt(target) : created });

  return { target, sketchDir };
};

const readSketchAt = (target: string) => {
  const found = findSketch({
    productDir: join(target, DESIGN_DIR, 'acme'),
    product: 'acme',
    sketch: { layer: 'elements', name: 'hero' },
  });

  if (found === null || typeof found === 'string') throw new Error(`no sketch: ${found}`);

  return found;
};

const SLIDER = `import { definePart, drawing } from '@design-system';

export default definePart({
  note: 'Der Slider des Hero.',
  states: { rest: {} },
  describe: { rest: 'The slider at rest; check that it reads.' },
  render: () => drawing({ body: '<div class="acme-hero-slider"></div>', styles: '' }),
});
`;

const withMarkedSlider = (sketchDir: string) => {
  const file = join(sketchDir, 'sketch.json');
  const sketch = JSON.parse(readFileSync(file, 'utf8')) as { variantInfo: Record<string, object> };

  mkdirSync(join(sketchDir, 'b/components/hero-slider'), { recursive: true });
  writeFileSync(join(sketchDir, 'b/components/hero-slider/hero-slider.ts'), SLIDER);
  writeFileSync(
    file,
    JSON.stringify({
      ...sketch,
      variantInfo: { ...sketch.variantInfo, b: { ...sketch.variantInfo['b'], subParts: ['components/hero-slider'] } },
    }),
  );
};

const subSketchDirOf = (target: string, name = 'hero-slider') =>
  join(target, DESIGN_DIR, `acme/sketches/components-${name}`);

const withTwoMarkedVariants = (sketchDir: string) => {
  const file = join(sketchDir, 'sketch.json');
  const sketch = JSON.parse(readFileSync(file, 'utf8')) as { variantInfo: Record<string, object> };
  const marks = { a: ['hero-slider', 'hero-caption'], b: ['hero-slider', 'hero-dots', 'hero-badge'] };

  for (const [variant, names] of Object.entries(marks))
    for (const name of names) {
      mkdirSync(join(sketchDir, variant, 'components', name), { recursive: true });
      writeFileSync(
        join(sketchDir, variant, 'components', name, `${name}.ts`),
        SLIDER.replace('acme-hero-slider', `acme-${name}`),
      );
    }

  writeFileSync(
    file,
    JSON.stringify({
      ...sketch,
      variantInfo: Object.fromEntries(
        Object.entries(marks).map(([variant, names]) => [
          variant,
          { ...sketch.variantInfo[variant], subParts: names.map((name) => `components/${name}`) },
        ]),
      ),
    }),
  );
};

const markSubReady = (target: string, name: string) => {
  const sub = findSketch({
    productDir: join(target, DESIGN_DIR, 'acme'),
    product: 'acme',
    sketch: { layer: 'components', name },
  });

  if (sub === null || typeof sub === 'string') throw new Error(`no sub-sketch: ${sub}`);

  markSketchReady({ checkout: target, sketch: sub });
};

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

const pick = (target: string, variant: string, sketch = 'elements/hero', extra: Record<string, unknown> = {}) =>
  sketchDecisionAnswer({
    target,
    url: new URL(`http://localhost/?product=acme&sketch=${sketch}`),
    request: Object.assign(Readable.from([JSON.stringify({ kind: 'pick', variant, ...extra })]), {
      method: 'POST',
    }) as unknown as IncomingMessage,
    signal: new AbortController().signal,
  });

const approve = (target: string, variant: string, sketch = 'components/hero-slider') =>
  sketchApproveAnswer({
    target,
    url: new URL(`http://localhost/?product=acme&sketch=${sketch}`),
    request: Object.assign(Readable.from([JSON.stringify({ variant })]), {
      method: 'POST',
    }) as unknown as IncomingMessage,
    signal: new AbortController().signal,
  });

const sketchCommand = (target: string, argv: string[]) =>
  designSketch({
    target,
    argv: [...argv, '--product', 'acme', '--by', 'claude-opus-5-5'],
    invocation: 'et design',
  });

const withReadySubSketch = async (beforeReady?: (sketchDir: string) => void) => {
  const { target, sketchDir } = readied((dir) => {
    withMarkedSlider(dir);
    beforeReady?.(dir);
  });

  await pick(target, 'b');

  const sub = findSketch({
    productDir: join(target, DESIGN_DIR, 'acme'),
    product: 'acme',
    sketch: { layer: 'components', name: 'hero-slider' },
  });

  if (sub === null || typeof sub === 'string') throw new Error(`no sub-sketch: ${sub}`);

  markSketchReady({ checkout: target, sketch: sub });

  return { target, sketchDir, subDir: subSketchDirOf(target) };
};

const withApprovedSubSketch = async (
  options: { beforeReady?: (sketchDir: string) => void; subEdit?: (subDir: string) => void } = {},
) => {
  const ready = await withReadySubSketch(options.beforeReady);

  writeFileSync(
    join(ready.subDir, 'a/components/hero-slider/hero-slider.ts'),
    SLIDER.replace('acme-hero-slider', 'acme-hero-slider-approved'),
  );
  options.subEdit?.(ready.subDir);
  await approve(ready.target, 'a');

  return ready;
};

const productTokensOf = (target: string) => join(target, DESIGN_DIR, 'acme/shared/tokens.ts');

const withProductTokens = (sketchDir: string) => {
  const shared = join(sketchDir, '../../shared');

  mkdirSync(shared, { recursive: true });
  writeFileSync(join(shared, 'tokens.ts'), "export const accent = 'old';\n");
};

const writeIn = (dir: string, path: string, content: string) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), content);
};

const productFileOf = (target: string, part: string) =>
  join(target, DESIGN_DIR, 'acme', part, `${part.split('/')[1]}.ts`);

describe('the Studio pick route', { timeout: 60_000 }, () => {
  // Decision: a pick in Studio is a merge; there is no picked-but-unmerged state.
  it('merges the picked variant at once', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir } = readied();
    const answer = await pick(target, 'b');

    expect(answer).toMatchObject({ status: 200, body: { merged: ['elements/hero'] } });
    expect(existsSync(sketchDir)).toBe(false);
    expect(JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/merged.json'), 'utf8'))).toMatchObject({
      'elements/hero': { variant: 'b' },
    });
  });

  it('refuses a pick whose merge is refused and leaves no pick behind', async () => {
    const { target, sketchDir } = readied();
    const file = join(sketchDir, 'sketch.json');
    const sketch = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

    writeFileSync(file, JSON.stringify({ ...sketch, baseline: undefined }));

    const before = readFileSync(file, 'utf8');
    const answer = await pick(target, 'b');

    expect(answer.status).toBe(422);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  // Decision B726: a Studio pick of a variant with marked sub-parts opens one sketch per sub-part, seeded from the variant, and merges nothing.
  it('opens a sub-sketch per marked sub-part instead of merging', async () => {
    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);

    const answer = await pick(target, 'b');
    const sub = subSketchDirOf(target);

    expect(answer).toMatchObject({ status: 200, body: { merged: [], subSketches: ['components/hero-slider'] } });
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
    expect(readJson(join(sketchDir, 'sketch.json'))).toMatchObject({
      decision: { kind: 'pick', variant: 'b' },
      subSketches: ['components/hero-slider'],
    });
    expect(readJson(join(sub, 'sketch.json'))).toMatchObject({
      target: 'components/hero-slider',
      parent: 'elements/hero',
      status: 'in progress',
    });
    expect(readFileSync(join(sub, 'a/components/hero-slider/hero-slider.ts'), 'utf8')).toContain('acme-hero-slider');
  });

  // Decision B726: the parent does not merge on its own while the sub-sketches its pick opened are open.
  it('refuses a merge of the parent while its sub-sketches are open', async () => {
    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);
    await pick(target, 'b');

    const answer = await pick(target, 'b');

    expect(answer.status).toBe(422);
    expect(JSON.stringify(answer.body)).toContain('waits on its sub-sketches components/hero-slider');
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });

  // Decision B726: `sketch pick` in chat takes the same way as the Studio pick, so an agent cannot merge past the sub-parts.
  it('opens the sub-sketches on sketch pick', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);

    const code = await designSketch({
      target,
      argv: [
        'pick',
        'elements/hero',
        '--variant',
        'b',
        '--mandate',
        'human in chat: b',
        '--product',
        'acme',
        '--by',
        'claude-opus-5-5',
      ],
      invocation: 'et design',
    });

    expect(code).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
    expect(readJson(join(subSketchDirOf(target), 'sketch.json'))).toMatchObject({ parent: 'elements/hero' });
  });

  it('refuses a pick of another variant that discards sub-sketches without the confirmation and names them', async () => {
    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);
    await pick(target, 'b');

    const before = readFileSync(join(sketchDir, 'sketch.json'), 'utf8');
    const answer = await pick(target, 'a');

    expect(answer).toMatchObject({
      status: 409,
      body: { reason: 'discards-sub-sketches', findings: ['components/hero-slider'] },
    });
    expect(readFileSync(join(sketchDir, 'sketch.json'), 'utf8')).toBe(before);
    expect(existsSync(subSketchDirOf(target))).toBe(true);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });

  it('discards the approved and the open sub-sketches the new variant does not mark, keeps the shared one and opens its new one', async () => {
    const { target, sketchDir } = readied(withTwoMarkedVariants);

    await pick(target, 'b');
    markSubReady(target, 'hero-dots');
    await approve(target, 'a', 'components/hero-dots');

    const answer = await pick(target, 'a', 'elements/hero', { discardSubSketches: true });

    expect(answer).toMatchObject({
      status: 200,
      body: {
        merged: [],
        subSketches: ['components/hero-slider', 'components/hero-caption'],
        discarded: ['components/hero-dots', 'components/hero-badge'],
      },
    });
    expect(readJson(join(sketchDir, 'sketch.json'))).toMatchObject({
      decision: { kind: 'pick', variant: 'a' },
      subSketches: ['components/hero-slider', 'components/hero-caption'],
    });
    expect(existsSync(subSketchDirOf(target, 'hero-dots'))).toBe(false);
    expect(existsSync(subSketchDirOf(target, 'hero-badge'))).toBe(false);
    expect(readJson(join(subSketchDirOf(target), 'sketch.json'))).toMatchObject({ parent: 'elements/hero' });
    expect(readJson(join(subSketchDirOf(target, 'hero-caption'), 'sketch.json'))).toMatchObject({
      parent: 'elements/hero',
    });
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });

  it('merges a re-picked variant that marks no sub-part once its sub-sketches are discarded', async () => {
    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);
    await pick(target, 'b');

    const answer = await pick(target, 'a', 'elements/hero', { discardSubSketches: true });

    expect(answer).toMatchObject({ status: 200, body: { merged: expect.arrayContaining(['elements/hero']) } });
    expect(existsSync(subSketchDirOf(target))).toBe(false);
    expect(readJson(join(target, DESIGN_DIR, 'acme/merged.json'))).toMatchObject({ 'elements/hero': { variant: 'a' } });
  });

  it('needs --discard-sub-sketches on sketch pick of another variant and prints what it discards and keeps', async () => {
    const logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { target, sketchDir } = readied(withTwoMarkedVariants);
    const repick = ['pick', 'elements/hero', '--variant', 'a', '--mandate', 'human in chat: a after all'];

    await pick(target, 'b');

    const refused = await sketchCommand(target, repick);

    expect(refused).not.toBe(0);
    expect(errors.mock.calls.flat().join('\n')).toContain(
      'discards the sub-sketches components/hero-dots, components/hero-badge and keeps components/hero-slider',
    );
    expect(existsSync(subSketchDirOf(target, 'hero-dots'))).toBe(true);

    expect(await sketchCommand(target, [...repick, '--discard-sub-sketches'])).toBe(0);

    const printed = logs.mock.calls.flat().join('\n');

    expect(printed).toContain('discarded the sub-sketches components/hero-dots, components/hero-badge');
    expect(printed).toContain('kept the sub-sketches components/hero-slider');
    expect(existsSync(subSketchDirOf(target, 'hero-dots'))).toBe(false);
    expect(readJson(join(sketchDir, 'sketch.json'))).toMatchObject({ decision: { variant: 'a' } });
  });

  it('answers the open sub-sketches as findings when the parent pick again waits on them', async () => {
    const { target } = await withReadySubSketch();

    expect(await pick(target, 'b')).toMatchObject({
      status: 422,
      body: { reason: 'sub-sketches-open', findings: ['components/hero-slider'] },
    });
  });

  it('lists the sub-sketches of a parent that are not approved yet', async () => {
    const { target } = readied(withTwoMarkedVariants);

    await pick(target, 'b');
    markSubReady(target, 'hero-dots');
    await approve(target, 'a', 'components/hero-dots');

    const answer = await sketchesAnswer({
      target,
      url: new URL('http://localhost/__design/sketches?product=acme&unchanged=no&targets=no'),
      request: { method: 'GET' } as IncomingMessage,
      load: () => new Promise(() => undefined),
    });
    const listed = (answer.body as { sketches: { target: string; openSubSketches?: string[] }[] }).sketches;

    expect(listed.find(({ target }) => target === 'elements/hero')?.openSubSketches).toEqual([
      'components/hero-slider',
      'components/hero-badge',
    ]);
  });

  it('refuses sketch approve on a sub-sketch in progress and names sketch ready', async () => {
    const { target } = readied(withMarkedSlider);

    await pick(target, 'b');

    expect(await approve(target, 'a')).toMatchObject({ status: 422 });
    expect(JSON.stringify((await approve(target, 'a')).body)).toContain(
      'mark it ready first (design sketch ready components/hero-slider)',
    );
  });

  // Decision B726: a sub-sketch is approved, never merged; the approval waits on the sub-sketch for its parent's merge.
  it('records the approval of a sub-sketch on sketch approve', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, subDir } = await withReadySubSketch();
    const code = await sketchCommand(target, [
      'approve',
      'components/hero-slider',
      '--variant',
      'a',
      '--decided-by',
      'human in chat: slider ok',
    ]);

    expect(code).toBe(0);
    expect(readJson(join(subDir, 'sketch.json'))).toMatchObject({
      parent: 'elements/hero',
      approved: { variant: 'a', comment: 'human in chat: slider ok', by: 'designer' },
    });
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });

  it('records the approval of a sub-sketch on the Studio approve route', async () => {
    const { target, subDir } = await withReadySubSketch();
    const answer = await approve(target, 'a');

    expect(answer).toMatchObject({ status: 200, body: { approved: { variant: 'a', by: 'designer' } } });
    expect(readJson(join(subDir, 'sketch.json'))).toMatchObject({ approved: { variant: 'a' } });
  });

  // Decision B726: only a sketch a parent's pick opened is approved; any other sketch is picked and merged.
  it('refuses sketch approve on a sketch without a parent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { target, sketchDir } = readied();
    const before = readFileSync(join(sketchDir, 'sketch.json'), 'utf8');
    const code = await sketchCommand(target, [
      'approve',
      'elements/hero',
      '--variant',
      'a',
      '--decided-by',
      'human in chat: a',
    ]);

    expect(code).not.toBe(0);
    expect(readFileSync(join(sketchDir, 'sketch.json'), 'utf8')).toBe(before);
    expect(await approve(target, 'a', 'elements/hero')).toMatchObject({ status: 422 });
  });

  // Decision B726: a sub-sketch merges only together with its parent, so every merge path refuses it and names the parent.
  it('refuses a merge of a sub-sketch and names its parent', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { target, subDir } = await withReadySubSketch();
    const named = 'is a sub-sketch of elements/hero';

    const studioPick = await pick(target, 'a', 'components/hero-slider');
    const code = await sketchCommand(target, ['merge', 'components/hero-slider']);

    expect(studioPick.status).toBe(422);
    expect(JSON.stringify(studioPick.body)).toContain(named);
    expect(code).not.toBe(0);
    expect(errors.mock.calls.flat().join('\n')).toContain(named);
    expect(readJson(join(subDir, 'sketch.json'))['decision']).toBeUndefined();
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });

  // Decision B726: Übernehmen on the parent stays refused until every sub-sketch is approved, and says which wait.
  it('refuses the parent pick again while a sub-sketch is not approved and names it', async () => {
    const { target, sketchDir } = await withReadySubSketch();
    const answer = await pick(target, 'b');

    expect(answer.status).toBe(422);
    expect(JSON.stringify(answer.body)).toContain('waits on its sub-sketches components/hero-slider');
    expect(JSON.stringify(answer.body)).toContain('design sketch approve');
    expect(existsSync(sketchDir)).toBe(true);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });

  // Decision B726: once every sub-sketch is approved, one merge writes the parent and each approved sub-part and closes them.
  it('merges the parent with its approved sub-sketch on sketch merge', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir, subDir } = await withApprovedSubSketch();
    const code = await sketchCommand(target, ['merge', 'elements/hero']);

    expect(code).toBe(0);
    expect(existsSync(sketchDir)).toBe(false);
    expect(existsSync(subDir)).toBe(false);
    expect(readFileSync(productFileOf(target, 'components/hero-slider'), 'utf8')).toContain(
      'acme-hero-slider-approved',
    );
    expect(readJson(join(target, DESIGN_DIR, 'acme/merged.json'))).toMatchObject({
      'elements/hero': { variant: 'b' },
      'components/hero-slider': { variant: 'a', decidedBy: 'user' },
    });
  });

  it('merges the parent with its approved sub-sketch on the Studio pick route', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir, subDir } = await withApprovedSubSketch();
    const answer = await pick(target, 'b');

    expect(answer).toMatchObject({ status: 200 });
    expect((answer.body as { merged: string[] }).merged).toEqual(
      expect.arrayContaining(['elements/hero', 'components/hero-slider']),
    );
    expect(existsSync(sketchDir)).toBe(false);
    expect(existsSync(subDir)).toBe(false);
    expect(readFileSync(productFileOf(target, 'components/hero-slider'), 'utf8')).toContain(
      'acme-hero-slider-approved',
    );
    expect(readJson(join(target, DESIGN_DIR, 'acme/merged.json'))).toMatchObject({
      'elements/hero': { variant: 'b' },
      'components/hero-slider': { variant: 'a' },
    });
  });

  // Decision B726: the parent merge writes an approved sub-sketch's shared/ and asset changes like a sketch merge does.
  it("writes an approved sub-sketch's shared/ token edit on the parent merge", async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target } = await withApprovedSubSketch({
      beforeReady: withProductTokens,
      subEdit: (subDir) => writeIn(subDir, 'shared/tokens.ts', "export const accent = 'sub';\n"),
    });

    expect(await sketchCommand(target, ['merge', 'elements/hero'])).toBe(0);
    expect(readFileSync(productTokensOf(target), 'utf8')).toMatch(/accent = .sub./);
  });

  it("writes an approved sub-sketch's new asset on the parent merge", async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target } = await withApprovedSubSketch({
      subEdit: (subDir) => writeIn(subDir, 'a/assets/slide.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n'),
    });

    expect(await sketchCommand(target, ['merge', 'elements/hero'])).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/assets/slide.svg'))).toBe(true);
  });

  // Decision B726: two sketches of one merge changing the same shared/ or asset file refuse it before any write.
  const withClashingTokens = () =>
    withApprovedSubSketch({
      beforeReady: (sketchDir) => {
        withProductTokens(sketchDir);
        writeIn(sketchDir, 'shared/tokens.ts', "export const accent = 'parent';\n");
      },
      subEdit: (subDir) => writeIn(subDir, 'shared/tokens.ts', "export const accent = 'sub';\n"),
    });

  it('refuses the parent merge when it and a sub-sketch change the same shared/ file', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir, subDir } = await withClashingTokens();

    expect(await sketchCommand(target, ['merge', 'elements/hero'])).not.toBe(0);
    expect(errors.mock.calls.flat().join('\n')).toContain(
      'shared/tokens.ts is changed by elements/hero and components/hero-slider',
    );
    expect(readFileSync(productTokensOf(target), 'utf8')).toMatch(/accent = .old./);
    expect(existsSync(sketchDir)).toBe(true);
    expect(existsSync(subDir)).toBe(true);
    expect(existsSync(productFileOf(target, 'components/hero-slider'))).toBe(false);
  });

  it('refuses the parent merge on the Studio pick route when it and a sub-sketch change the same shared/ file', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir, subDir } = await withClashingTokens();
    const answer = await pick(target, 'b');

    expect(answer).toMatchObject({ status: 422 });
    expect(JSON.stringify(answer.body)).toContain(
      'shared/tokens.ts is changed by elements/hero and components/hero-slider',
    );
    expect(readFileSync(productTokensOf(target), 'utf8')).toMatch(/accent = .old./);
    expect(existsSync(sketchDir)).toBe(true);
    expect(existsSync(subDir)).toBe(true);
  });

  // Decision B726: every part the parent merge writes, sub-parts included, takes a new shared/ file into the product.
  it('merges a new shared/ file that only the approved sub-part imports', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target } = await withApprovedSubSketch({
      subEdit: (subDir) => {
        writeIn(subDir, 'shared/slide-tokens.ts', 'export const slide = 1;\n');
        appendFileSync(
          join(subDir, 'a/components/hero-slider/hero-slider.ts'),
          "\nimport { slide } from '@shared/slide-tokens';\nexport const slideCount = slide;\n",
        );
      },
    });

    expect(await sketchCommand(target, ['merge', 'elements/hero'])).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/components/hero-slider/shared/slide-tokens.ts'))).toBe(true);
  });

  it('still refuses a shared/ file that no part of the merge imports', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target } = await withApprovedSubSketch({
      beforeReady: (sketchDir) => {
        writeIn(sketchDir, 'shared/hero-tokens.ts', 'export const hero = 1;\n');
        appendFileSync(
          join(sketchDir, 'b/elements/hero/hero.ts'),
          "\nimport { hero } from '@shared/hero-tokens';\nexport const heroSize = hero;\n",
        );
      },
      subEdit: (subDir) => {
        writeIn(subDir, 'shared/slide-tokens.ts', 'export const slide = 1;\n');
        writeIn(subDir, 'shared/unused.ts', 'export const unused = 1;\n');
        appendFileSync(
          join(subDir, 'a/components/hero-slider/hero-slider.ts'),
          "\nimport { slide } from '@shared/slide-tokens';\nexport const slideCount = slide;\n",
        );
      },
    });

    expect(await sketchCommand(target, ['merge', 'elements/hero'])).not.toBe(0);
    expect(errors.mock.calls.flat().join('\n')).toContain('unused.ts');
  });
});
