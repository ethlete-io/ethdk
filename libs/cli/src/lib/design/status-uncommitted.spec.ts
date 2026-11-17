import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { git } from '../git-test-env.fixtures';
import { readConfig } from './design-config';
import { designStatus } from './status';
import { resolveProduct } from './system/resolve-product';
import { createSketch, decideSketch, markSketchReady, Sketch } from './system/sketch/sketch';
import { originOf } from './system/write-origin';

vi.mock('./push-status', () => ({
  pushStatusOf: () => ({ base: 'origin/next', unpushed: 0 }),
  pushStatusLines: () => ['nothing unpushed (origin/next)'],
}));

const targets: string[] = [];
const at = '2026-11-14T00:00:00.000Z';

const commitAll = (target: string) => {
  git(target, 'add', '-A');
  git(target, '-c', 'user.name=spec', '-c', 'user.email=spec@example.com', 'commit', '-q', '-m', 'acme');
};

const committedAcme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-status-uncommitted-'));

  targets.push(target);
  cpSync(join(__dirname, 'system', '__fixtures__'), target, { recursive: true });
  writeReady(target, { 'pages/home': { hash: 'h1', at } });
  git(target, 'init', '-q');
  commitAll(target);

  return target;
};

const productDirOf = (target: string) => join(target, '.ethlete/design/acme');

const writeReady = (target: string, entries: Record<string, object>) =>
  writeFileSync(join(productDirOf(target), 'ready.json'), `${JSON.stringify(entries, null, 2)}\n`);

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const statusLines = (target: string) => {
  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(...String(line).split('\n')));
  expect(designStatus({ target, argv: [], invocation: 'et design' })).toBe(0);
  vi.restoreAllMocks();

  return lines.filter((line) => /^(READY UNCOMMITTED|SKETCH UNTRACKED|SKETCH LEFTOVER) /u.test(line));
};

afterEach(() => {
  vi.restoreAllMocks();
  targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
});

describe('design status and uncommitted design state', () => {
  it('names each ready mark that differs from HEAD, one line per part', () => {
    const target = committedAcme();

    writeReady(target, {
      'components/button': { hash: 'h2', at },
      'elements/hero': { actions: [], at },
      'pages/home': { hash: 'h3', at },
    });

    expect(statusLines(target)).toEqual([
      'READY UNCOMMITTED acme components/button: marked ready, HEAD has no mark - run `design ready components/button` to commit it',
      'READY UNCOMMITTED acme pages/home: the mark differs from HEAD - run `design ready pages/home` to commit it',
    ]);

    writeReady(target, {});

    expect(statusLines(target)).toEqual([
      'READY UNCOMMITTED acme pages/home: the mark HEAD holds is gone - run `design ready pages/home` to commit the removal',
    ]);
  });

  it('names untracked, empty and stale direct-edit sketch folders, and nothing once they are committed or gone', () => {
    const target = committedAcme();
    const product = resolveAcme(target);
    const sketches = join(productDirOf(target), 'sketches');

    const argv = process.argv;

    process.argv = ['node', 'et', 'design', 'sketch', 'open', 'pages/home'];
    createSketch({ product, sketch: { layer: 'pages', name: 'home' }, variants: ['a'] });
    process.argv = ['node', 'et', 'design', 'check'];
    createSketch({ product, sketch: { layer: 'elements', name: 'hero', sketch: 'edit' }, variants: ['new'] });
    process.argv = argv;
    mkdirSync(join(sketches, 'components-gone'), { recursive: true });

    const today = new Date().toISOString().slice(0, 10);

    expect(statusLines(target)).toEqual([
      `SKETCH LEFTOVER acme elements-hero.edit: elements/hero@edit, in progress, created ${today}, by \`design check\` - its part matches HEAD, discard it: sketch discard elements/hero@edit --product acme --by <model id>`,
      `SKETCH UNTRACKED acme pages-home: pages/home, in progress, created ${today}, by \`design sketch open pages/home\` - commit it or discard it`,
      'SKETCH LEFTOVER acme components-gone: holds no sketch file - delete the folder',
    ]);

    rmSync(join(sketches, 'elements-hero.edit'), { recursive: true });
    rmSync(join(sketches, 'components-gone'), { recursive: true });
    commitAll(target);

    expect(statusLines(target)).toEqual([]);
  });

  const pickAndCommitHero = (variant: string) => {
    const target = committedAcme();

    writeFileSync(join(productDirOf(target), 'elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero', sketch: 'edit' },
      variants: ['new', 'old'],
    }) as Sketch;

    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;

    expect(typeof decideSketch({ sketch: ready, decision: { kind: 'pick', variant, ...originOf('spec') } })).toBe(
      'object',
    );
    git(target, 'add', join(productDirOf(target), 'elements/hero'));
    git(target, '-c', 'user.name=spec', '-c', 'user.email=spec@example.com', 'commit', '-q', '-m', 'hero');

    const lines: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(...String(line).split('\n')));
    expect(designStatus({ target, argv: [], invocation: 'et design' })).toBe(0);

    return lines.filter((line) => /elements[/-]hero[@.]edit/u.test(line));
  };

  it('names a picked edit sketch whose changed part HEAD holds once, with the check that clears it', () => {
    expect(pickAndCommitHero('new')).toEqual([
      expect.stringMatching(
        /^SKETCH LEFTOVER acme elements-hero\.edit: elements\/hero@edit, ready, .* the next check clears it: design check --product acme --part elements\/hero$/u,
      ),
    ]);
  });

  it('names an edit sketch picked old whose part HEAD holds changed once, with its merge', () => {
    expect(pickAndCommitHero('old')).toEqual([
      expect.stringMatching(
        /^SKETCH LEFTOVER acme elements-hero\.edit: elements\/hero@edit, ready, .* its part matches HEAD, but the pick of old contradicts the part at HEAD - merge it to restore the part to old: sketch merge elements\/hero@edit --product acme --by <model id>$/u,
      ),
    ]);
  });
});
