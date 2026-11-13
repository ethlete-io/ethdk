import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { git } from '../../git-test-env.fixtures';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered } from './check-system';
import { partsCompletenessOf } from './complete';
import { renderIssuesOf } from './render-check';

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
    'leaves merged.json and ready.json byte-identical and still reports the dropped record (part %s)',
    async (part) => {
      const { target, dir } = committedAcme();

      targets.push(target);

      const config = readConfig(target) ?? {};
      const files = ['merged.json', 'ready.json'].map((file) => join(dir, file));
      const before = files.map((file) => readFileSync(file, 'utf8'));

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

      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(before);
      expect(lines).toContainEqual(expect.stringMatching(/^RECORD DROPPED acme elements\/hero: open-point/));
    },
    120_000,
  );
});
