import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered } from './check-system';
import { partsCompletenessOf } from './complete';
import { drawnFindingsFrom, drawnFindingsOf } from './drawn-open-points';
import { renderIssuesOf } from './render-check';
import { resolveProduct } from './resolve-product';

vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: vi.fn(),
}));

vi.mock('./complete', async (actual) => ({
  ...(await actual<typeof import('./complete')>()),
  partsCompletenessOf: vi.fn(),
}));

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-ready-blockers-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const contrast = {
  rule: 'CONTRAST',
  product: 'acme',
  sketch: null,
  part: 'elements/hero',
  state: 'default',
  path: 'p',
  size: 'fitted',
  detail: 'under the rule',
};

describe('design check shows what design ready refuses', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists the same missing states, contrasts and undrawable parts as ready', async () => {
    const target = acme();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'definePart<HeroProps>({',
        "definePart<HeroProps>({ controls: { cta: { kind: 'button', input: ['pointer'] } },",
      ),
    );

    const config = readConfig(target) ?? {};
    const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });

    vi.mocked(renderIssuesOf).mockResolvedValue({ issues: [contrast], warnings: [] } as never);
    vi.mocked(partsCompletenessOf).mockResolvedValue({
      gaps: new Map<string, never[] | string>([
        ['elements/hero', [{ code: 'CONTROL-UNDRAWN', target: 'elements/hero.cta', detail: '' }] as never],
        ['components/card', 'it threw while drawing'],
      ]),
      exceptions: [],
      hints: new Map(),
    });

    const lines: string[] = [];
    const push = (line: unknown) => void lines.push(String(line));

    vi.spyOn(console, 'log').mockImplementation(push);
    vi.spyOn(console, 'error').mockImplementation(push);
    vi.spyOn(console, 'warn').mockImplementation(push);

    await checkSystemRendered({ target, config, products: ['acme'] });

    expect(
      drawnFindingsFrom({
        product,
        issues: [],
        gaps: new Map([['components/card', 'it threw while drawing']]),
        stateful: ['components/card'],
      }).failed,
    ).toEqual(['components/card: it threw while drawing']);
    expect(lines).toContain(
      'CANNOT DRAW acme components/card: it threw while drawing - et design ready refuses the part until it draws',
    );
    expect(lines.filter((line) => line.startsWith('  elements/hero'))).toEqual([
      expect.stringMatching(/1 missing state \(cta\); 1 contrast under the rule \(state default\)/),
    ]);
  }, 120_000);

  it('refuses ready on a state that did not draw, and check names it as a part ready refuses', async () => {
    const target = acme();
    const config = readConfig(target) ?? {};
    const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });
    const undrawn = {
      ...contrast,
      rule: 'RENDER',
      part: 'pages/home',
      state: 'empty',
      path: '#root',
      detail: 'design-explore: state "empty" of "pages/home" failed - films is undefined',
    };

    vi.mocked(renderIssuesOf).mockResolvedValue({
      issues: [undrawn, { ...undrawn, size: 'phone' }],
      warnings: [],
    } as never);
    vi.mocked(partsCompletenessOf).mockResolvedValue({ gaps: new Map(), exceptions: [], hints: new Map() });

    expect(
      drawnFindingsFrom({
        product,
        issues: [
          { ...undrawn, rule: 'RENDER-TIMEOUT', state: '-', detail: 'drawing the part did not finish within 120s' },
        ],
        gaps: null,
        stateful: [],
      }).failed,
    ).toEqual(['pages/home: drawing the part did not finish within 120s']);
    expect(await drawnFindingsOf({ target, config, product, parts: ['pages/home'] })).toEqual({
      unavailable:
        'pages/home: state empty did not draw - design-explore: state "empty" of "pages/home" failed - films is undefined',
    });

    const lines: string[] = [];
    const push = (line: unknown) => void lines.push(String(line));

    vi.spyOn(console, 'log').mockImplementation(push);
    vi.spyOn(console, 'error').mockImplementation(push);
    vi.spyOn(console, 'warn').mockImplementation(push);

    expect(await checkSystemRendered({ target, config, products: ['acme'], part: 'pages/home' })).toBe(1);
    expect(lines.filter((line) => line.startsWith('CANNOT DRAW'))).toEqual([
      'CANNOT DRAW acme pages/home: state empty did not draw - design-explore: state "empty" of "pages/home" failed - films is undefined - et design ready refuses the part until it draws',
    ]);
  }, 120_000);

  it('names each stateful part design ready cannot draw when the render check is skipped', async () => {
    const target = acme();
    const config = readConfig(target) ?? {};

    vi.mocked(renderIssuesOf).mockResolvedValue({ unavailable: 'no browser' } as never);

    const lines: string[] = [];
    const push = (line: unknown) => void lines.push(String(line));

    vi.spyOn(console, 'log').mockImplementation(push);
    vi.spyOn(console, 'error').mockImplementation(push);
    vi.spyOn(console, 'warn').mockImplementation(push);

    await checkSystemRendered({ target, config, products: ['acme'], part: 'elements/hero' });

    expect(lines).toContain(
      'CANNOT DRAW acme elements/hero: no browser - et design ready refuses the part until it draws',
    );
    expect(lines.filter((line) => line.startsWith('CANNOT DRAW'))).toHaveLength(1);
  }, 120_000);
});
