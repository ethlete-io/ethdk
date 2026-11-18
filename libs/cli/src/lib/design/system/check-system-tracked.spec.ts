import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { git } from '../../git-test-env.fixtures';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered } from './check-system';
import { partsCompletenessOf } from './complete';
import { renderIssuesOf } from './render-check';
import { partKeyOf, resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';

vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: vi.fn(),
}));

vi.mock('./complete', async (actual) => ({
  ...(await actual<typeof import('./complete')>()),
  partsCompletenessOf: vi.fn(),
}));

vi.mock('./actions-command', async (actual) => ({
  ...(await actual<typeof import('./actions-command')>()),
  partActionFailuresOf: vi.fn(async () => []),
}));

vi.mock('./action-lost', async (actual) => ({
  ...(await actual<typeof import('./action-lost')>()),
  declaredPartActionsOf: vi.fn(async () => []),
}));

const committedAcme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-check-tracked-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  const dir = join(target, DESIGN_DIR, 'acme');
  const at = '2026-11-01T00:00:00.000Z';

  writeFileSync(join(dir, 'merged.json'), `${JSON.stringify({ 'elements/hero': 'stale' }, null, 2)}\n`);
  writeFileSync(
    join(dir, 'ready.json'),
    `${JSON.stringify(
      {
        'components/button': { hash: 'stale', actions: [], at },
        'elements/hero': { hash: 'stale', actions: [], at },
        'pages/home': { actions: [], at },
      },
      null,
      2,
    )}\n`,
  );
  git(target, 'init', '-q');
  git(target, 'config', 'maintenance.auto', 'false');
  git(target, 'config', 'gc.auto', '0');
  git(target, 'add', '-A');
  git(target, '-c', 'user.name=spec', '-c', 'user.email=spec@example.com', 'commit', '-q', '-m', 'acme');

  return { target, dir };
};

describe('a design check and the tracked stamp files', () => {
  const targets: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
  });

  it.each([undefined, 'elements/hero'])(
    'drops the record in ready.json uncommitted and reports it (part %s)',
    async (part) => {
      const { target, dir } = committedAcme();

      targets.push(target);

      const config = readConfig(target) ?? {};
      vi.mocked(renderIssuesOf).mockResolvedValue({ issues: [], warnings: [] } as never);
      vi.mocked(partsCompletenessOf).mockResolvedValue({ gaps: new Map(), exceptions: [], hints: new Map() });
      const lines: string[] = [];

      vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await checkSystemRendered({
        target,
        config,
        products: ['acme'],
        ...(part ? { part } : {}),
        drawPictures: async ({ parts }) => new Map(parts.map((name) => [name, 'not drawn in this spec'])),
      });

      expect(lines).toContainEqual(expect.stringMatching(/^RECORD DROPPED acme elements\/hero: open-point/));
      expect(JSON.parse(readFileSync(join(dir, 'ready.json'), 'utf8'))).not.toHaveProperty(['elements/hero', 'hash']);
      expect(git(target, 'rev-list', '--count', 'HEAD')).toBe('1');
      expect(lines.slice(lines.findIndex((line) => line.startsWith('check complete')) + 1)).toContainEqual(
        expect.stringMatching(/^READY UNCOMMITTED acme elements\/hero: the mark HEAD holds is gone/u),
      );
    },
    120_000,
  );

  it.each([undefined, 'elements/hero'])(
    'writes the hash of a direct edit HEAD holds into merged.json uncommitted (part %s)',
    async (part) => {
      const { target, dir } = committedAcme();

      targets.push(target);
      vi.mocked(renderIssuesOf).mockResolvedValue({ issues: [], warnings: [] } as never);
      vi.mocked(partsCompletenessOf).mockResolvedValue({ gaps: new Map(), exceptions: [], hints: new Map() });
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const config = readConfig(target) ?? {};
      const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });
      const hero = product.parts.find((resolved) => partKeyOf(resolved) === 'elements/hero');

      await checkSystemRendered({
        target,
        config,
        products: ['acme'],
        ...(part ? { part } : {}),
        drawPictures: async ({ parts }) => new Map(parts.map((name) => [name, 'not drawn in this spec'])),
      });

      expect(JSON.parse(readFileSync(join(dir, 'merged.json'), 'utf8'))).toEqual({
        'elements/hero': partHashOf({ product, dir: dirname(hero?.file ?? '') }),
      });
      expect(git(target, 'rev-list', '--count', 'HEAD')).toBe('1');
    },
    120_000,
  );

  it('names the edit sketch it opened in its summary', async () => {
    const { target, dir } = committedAcme();

    targets.push(target);
    appendFileSync(join(dir, 'elements/hero/hero.ts'), '// direct edit\n');
    vi.mocked(renderIssuesOf).mockResolvedValue({ issues: [], warnings: [] } as never);
    vi.mocked(partsCompletenessOf).mockResolvedValue({ gaps: new Map(), exceptions: [], hints: new Map() });
    const lines: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await checkSystemRendered({
      target,
      config: readConfig(target) ?? {},
      products: ['acme'],
      part: 'elements/hero',
      drawPictures: async ({ parts }) => new Map(parts.map((name) => [name, 'not drawn in this spec'])),
    });

    expect(existsSync(join(dir, 'sketches/elements-hero.edit'))).toBe(true);
    const tail = lines.slice(lines.findIndex((line) => line.startsWith('check complete')) - 1);

    expect(tail.filter((line) => !line.startsWith('READY UNCOMMITTED '))).toEqual([
      'OPENED acme elements/hero@edit: direct edit of elements/hero - pick old or new',
      expect.stringMatching(/^check complete: /u),
      'EMBEDDERS PASS elements/hero: 1 part',
    ]);
  }, 120_000);
});
