import { originOf } from '../write-origin';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../design-config';
import { git } from '../git-repo.fixtures';
import { resolveProduct } from '../resolve-product';
import { baselineOf } from './baseline';
import { rebaseAfterCommit } from './after-merge';
import { mergeSketch } from './merge';
import { overlaySketch } from './overlay';
import { commitMergeResultSync } from './merge-commit';
import { journaledMergeOf } from './merge-step';
import { journaledRebaseOf } from './rebase-port';
import {
  createSketch,
  decideSketch,
  markSketchReady,
  readSketch,
  Sketch,
  SketchTarget,
  writeSketchFile,
} from './sketch';

const targets: string[] = [];

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-after-merge-'));

  targets.push(target);
  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');
  git(target, 'init', '-q');
  git(target, 'add', '-A');
  git(target, 'commit', '-qm', 'base');

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const readyOn = (target: string, sketch: SketchTarget) =>
  markSketchReady({
    checkout: target,
    sketch: createSketch({ product: resolveAcme(target), sketch, variants: ['a'] }) as Sketch,
  }) as Sketch;

const heroFile = (sketch: Sketch) => join(sketch.dir, 'a', 'elements/hero/hero.ts');

const edit = (file: string, from: string, to: string) =>
  writeFileSync(file, readFileSync(file, 'utf8').replace(from, to));

const reread = (sketch: Sketch) => readSketch({ product: 'acme', dir: sketch.dir }) as Sketch;

const output = () => {
  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));

  return lines;
};

const mergeHero = (target: string, hero: Sketch) =>
  mergeSketch({
    target,
    config: readConfig(target) ?? {},
    product: resolveAcme(target),
    sketch: decideSketch({ sketch: hero, decision: { kind: 'pick', variant: 'a', ...originOf('spec') } }) as Sketch,
  });

afterEach(() => {
  vi.restoreAllMocks();
  targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
});

describe('a merge and the other open sketches', { timeout: 120_000 }, () => {
  it('rebases an open sketch that embeds the merged part and keeps it ready', () => {
    const target = acme();
    const lines = output();
    const home = readyOn(target, { layer: 'pages', name: 'home' });
    const hero = readyOn(target, { layer: 'elements', name: 'hero' });

    edit(heroFile(hero), 'One featured film', 'The featured film');

    expect(mergeHero(target, hero)).toEqual(['elements/hero']);

    const after = reread(home);

    expect(after.baseline).toEqual(baselineOf(resolveAcme(target)));
    expect(after.status).toBe('ready');
    expect(after.portAfterMerge).toBeUndefined();
    expect(lines).toContain('REBASED acme pages/home after the merge of elements/hero');
  });

  it('rebases a composition sketch onto the new part it borrowed once that part merges', () => {
    const target = acme();
    const lines = output();
    const tabBar = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'components', name: 'tab-bar' },
      variants: ['a'],
    }) as Sketch;

    mkdirSync(join(tabBar.dir, 'a', 'components/tab-bar'), { recursive: true });
    writeFileSync(
      join(tabBar.dir, 'a', 'components/tab-bar/tab-bar.ts'),
      `import { definePart, drawing, html } from '@design-system';

export default definePart<{ active: string }>({
  note: 'The tabs at the bottom of the phone.',
  states: { start: { active: 'start' } },
  describe: { start: 'Two tabs with Start active; check that the active tab stands out.' },
  render: ({ active }) =>
    drawing({ body: html\`<nav class="acme-tab-bar" data-active="\${active}"><a>Start</a><a>Films</a></nav>\`, styles: '' }),
});
`,
    );
    writeSketchFile({ ...tabBar, recommended: 'a' }, { base: tabBar });

    const hero = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a'],
    }) as Sketch;

    edit(
      heroFile(hero),
      "import button from '@system/components/button';",
      "import button from '@system/components/button';\nimport tabBar from '@system/components/tab-bar';",
    );
    edit(
      heroFile(hero),
      "const play = await button.render({ label: 'Play' });",
      "const play = await button.render({ label: 'Play' });\n    const bar = await tabBar.render({ active: 'start' });",
    );
    edit(heroFile(hero), '${play.body}', '${play.body} ${bar.body}');

    expect(overlaySketch({ product: resolveAcme(target), sketch: hero, variant: 'a' }).borrowed).toEqual([
      { part: 'components/tab-bar', sketch: 'components/tab-bar', variant: 'a' },
    ]);

    const ready = markSketchReady({ checkout: target, sketch: reread(tabBar) }) as Sketch;

    expect(
      mergeSketch({
        target,
        config: readConfig(target) ?? {},
        product: resolveAcme(target),
        sketch: decideSketch({
          sketch: ready,
          decision: { kind: 'pick', variant: 'a', ...originOf('spec') },
        }) as Sketch,
      }),
    ).toEqual(['components/tab-bar']);

    const after = reread(hero);

    expect(lines).toContain('REBASED acme elements/hero after the merge of components/tab-bar');
    expect(after.baseline).toEqual(baselineOf(resolveAcme(target)));
    expect(overlaySketch({ product: resolveAcme(target), sketch: after, variant: 'a' }).borrowed).toEqual([]);
  });

  it('commits the sketches the merge rebased in the merge commit', () => {
    const target = acme();

    output();

    const home = readyOn(target, { layer: 'pages', name: 'home' });
    const drawn = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a'],
    }) as Sketch;

    edit(heroFile(drawn), 'One featured film', 'The featured film');

    const hero = markSketchReady({ checkout: target, sketch: drawn }) as Sketch;

    git(target, 'config', 'user.name', 't');
    git(target, 'config', 'user.email', 't@t');
    git(target, 'add', '-A');
    git(target, 'commit', '-qm', 'sketches');

    const product = resolveAcme(target);
    const config = readConfig(target) ?? {};
    const sketch = decideSketch({
      sketch: hero,
      decision: { kind: 'pick', variant: 'a', ...originOf('spec') },
    }) as Sketch;

    expect(
      journaledMergeOf({
        target,
        product,
        sketch,
        merge: () => mergeSketch({ target, config, product, sketch, deferRebase: true }),
        finish: (before, sketchDirs) =>
          void commitMergeResultSync({ target, product, sketch, variant: 'a', before, sketchDirs }),
      }),
    ).toEqual(['elements/hero']);
    expect(String(git(target, 'status', '--porcelain'))).toBe('');
    expect(reread(home).baseline).toEqual(baselineOf(resolveAcme(target)));
  });

  it('marks an open sketch whose rebase conflicts for its agent and names it in the merge output', () => {
    const target = acme();
    const lines = output();
    const other = readyOn(target, { layer: 'elements', name: 'hero', sketch: 'other' });
    const hero = readyOn(target, { layer: 'elements', name: 'hero' });

    edit(heroFile(other), 'One featured film', 'A featured film');
    edit(heroFile(hero), 'One featured film', 'The featured film');

    expect(mergeHero(target, hero)).toEqual(['elements/hero']);

    const after = reread(other);

    expect(after.status).toBe('ready');
    expect(after.portAfterMerge?.merged).toEqual(['elements/hero']);
    expect(after.portAfterMerge?.reasons).toEqual([
      'a: elements/hero/hero.ts - the variant and the product both changed it',
    ]);
    expect(readFileSync(heroFile(other), 'utf8')).toContain('A featured film');
    expect(lines).toContain(
      'AGENT PORTS acme elements/hero@other after the merge of elements/hero: a: elements/hero/hero.ts - the variant and the product both changed it - port it by hand, then run sketch rebase elements/hero@other --product acme --by <model id>',
    );
  });

  describe('a picked open sketch', () => {
    const pickedOther = (conflicting: 'a' | 'b') => {
      const target = acme();
      const lines = output();
      const drawn = createSketch({
        product: resolveAcme(target),
        sketch: { layer: 'elements', name: 'hero', sketch: 'other' },
        variants: ['a', 'b'],
      }) as Sketch;

      edit(join(drawn.dir, conflicting, 'elements/hero/hero.ts'), 'One featured film', 'A featured film');

      const other = decideSketch({
        sketch: markSketchReady({ checkout: target, sketch: drawn }) as Sketch,
        decision: { kind: 'pick', variant: 'a', ...originOf('designer') },
      }) as Sketch;
      const hero = readyOn(target, { layer: 'elements', name: 'hero' });

      edit(heroFile(hero), 'One featured film', 'The featured film');

      return { target, lines, other, hero };
    };

    it('rebases it when only a variant that is not the pick conflicts', () => {
      const { target, lines, other, hero } = pickedOther('b');

      expect(mergeHero(target, hero)).toEqual(['elements/hero']);
      expect(reread(other).portAfterMerge).toBeUndefined();
      expect(lines).toContain('REBASED acme elements/hero@other after the merge of elements/hero');
    });

    it('marks it for its agent when the picked variant conflicts', () => {
      const { target, lines, other, hero } = pickedOther('a');

      expect(mergeHero(target, hero)).toEqual(['elements/hero']);
      expect(reread(other).portAfterMerge?.reasons).toEqual([
        'a: elements/hero/hero.ts - the variant and the product both changed it',
      ]);
      expect(lines.some((line) => line.startsWith('AGENT PORTS acme elements/hero@other'))).toBe(true);
    });
  });

  it('clears the port mark once the agent has ported the sketch by hand and rebased it', () => {
    const target = acme();

    output();

    const other = readyOn(target, { layer: 'elements', name: 'hero', sketch: 'other' });
    const hero = readyOn(target, { layer: 'elements', name: 'hero' });

    edit(heroFile(other), 'One featured film', 'A featured film');
    edit(heroFile(hero), 'One featured film', 'The featured film');
    mergeHero(target, hero);

    const marked = reread(other);

    expect(marked.portAfterMerge?.at).toEqual(expect.any(String));

    const { rebased } = journaledRebaseOf({
      target,
      product: resolveAcme(target),
      sketch: marked,
      keepConflicts: () => true,
    });

    expect(rebased?.portAfterMerge).toBeUndefined();
    expect(reread(other).portAfterMerge).toBeUndefined();
  });

  it('clears the port mark when sketch ready judges the ported sketch', () => {
    const target = acme();
    const drawn = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a'],
    }) as Sketch;
    const marked: Sketch = {
      ...drawn,
      portAfterMerge: { merged: ['elements/hero'], parts: ['elements/hero'], reasons: ['a: check'], at: 'now' },
    };

    writeSketchFile(marked, { base: drawn });

    expect(reread(drawn).portAfterMerge?.merged).toEqual(['elements/hero']);

    markSketchReady({ checkout: target, sketch: reread(drawn) });

    expect(reread(drawn).portAfterMerge).toBeUndefined();
  });

  it('rebases an open sketch after a commit to a part it embeds, and leaves it alone after an unrelated commit', () => {
    const target = acme();
    const home = readyOn(target, { layer: 'pages', name: 'home' });
    const commitOf = (subject: string) => {
      git(target, 'add', '-A');
      git(target, 'commit', '-qm', subject);

      return String(git(target, 'diff-tree', '--root', '--no-commit-id', '--name-only', '-r', 'HEAD'))
        .split('\n')
        .filter(Boolean);
    };

    writeFileSync(join(target, 'notes.txt'), 'unrelated');

    expect(rebaseAfterCommit({ target, product: resolveAcme(target), commit: 'n', files: commitOf('notes') })).toEqual({
      lines: [],
      dirs: [],
    });

    edit(join(target, '.ethlete/design/acme/elements/hero/hero.ts'), 'One featured film', 'The featured film');

    const files = commitOf('hero');

    expect(reread(home).baseline).not.toEqual(baselineOf(resolveAcme(target)));
    expect(rebaseAfterCommit({ target, product: resolveAcme(target), commit: 'h', files })).toEqual({
      lines: ['REBASED acme pages/home after the commit h'],
      dirs: [home.dir],
    });

    const after = reread(home);

    expect(after.baseline).toEqual(baselineOf(resolveAcme(target)));
    expect(after.status).toBe('ready');
  });
});
