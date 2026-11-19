import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered, embeddersOfPart } from './check-system';
import { dropPartRecord } from './part-ready';
import { renderIssuesOf } from './render-check';

vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: vi.fn(async () => ({ issues: [], warnings: [] })),
}));

vi.mock('./part-ready', async (actual) => ({
  ...(await actual<typeof import('./part-ready')>()),
  dropPartRecord: vi.fn(() => false),
}));

vi.mock('./complete', async (actual) => ({
  ...(await actual<typeof import('./complete')>()),
  partsCompletenessOf: vi.fn(async () => ({ gaps: new Map(), exceptions: [], hints: new Map() })),
}));

vi.mock('./system-tsconfig', async (actual) => ({
  ...(await actual<typeof import('./system-tsconfig')>()),
  typecheckProduct: vi.fn(() => ({ kind: 'ok' })),
  typecheckProductAsync: vi.fn(async () => ({ kind: 'ok' })),
}));

vi.mock('./bespoke-controls', async (actual) => ({
  ...(await actual<typeof import('./bespoke-controls')>()),
  bespokeControlProblemsOf: vi.fn(async () => []),
}));

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-check-embedders-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, imports: string[]) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(
      join(design, 'app-a', path, `${path.split('/')[1]}.ts`),
      [
        ...imports.map((embedded, index) => `import embedded${index} from '@system/${embedded}';`),
        'export default definePart({ states: { default: {} }, describe: { default: "The part at rest." } });',
        `export const shown = [${imports.map((_, index) => `embedded${index}`).join(', ')}];`,
        '',
      ].join('\n'),
    );
  };

  part('components/frame', []);
  part('components/canvas', ['components/frame']);
  part('pages/inbox', ['components/canvas']);
  part('pages/other', []);
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

const covered = (part: string) => ({
  rule: 'COVERED',
  product: 'app-a',
  part,
  state: 'default',
  size: 'm',
  path: 'div',
  detail: 'covered by a sibling',
  sketch: null,
});

const dropped = () => vi.mocked(dropPartRecord).mock.calls.map(([{ part }]) => part);

const run = async (target: string, part: string) => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);
  vi.spyOn(console, 'warn').mockImplementation(push);

  const code = await checkSystemRendered({ target, config: readConfig(target) ?? {}, products: ['app-a'], part });

  return { code, lines };
};

describe('design check --part also checks the parts that embed it', () => {
  afterEach(() => vi.restoreAllMocks());

  it('finds the embedders of a part through the parts between them', () => {
    const target = checkout();

    expect(
      embeddersOfPart({ target, config: readConfig(target) ?? {}, products: ['app-a'], part: 'components/frame' }),
    ).toEqual([
      { part: 'components/canvas', products: ['app-a'] },
      { part: 'pages/inbox', products: ['app-a'] },
    ]);
  });

  it('fails the part when an embedder breaks, and passes it when every embedder passes', async () => {
    const target = checkout();
    const inspected = vi.mocked(renderIssuesOf);

    inspected.mockImplementation(async ({ jobs }) => ({
      issues: jobs.some((job) => job.parts?.includes('pages/inbox')) ? [covered('pages/inbox')] : [],
      warnings: [],
      grids: [],
      drawn: [],
    }));

    const broken = await run(target, 'components/frame');

    expect(broken.lines).not.toContain('PART app-a components/canvas: clean');
    expect(broken.lines).toContainEqual(expect.stringMatching(/^PART app-a pages\/inbox: 1 problem \(COVERED\)/u));
    expect(broken.lines).toContain(
      'EMBEDDERS FAIL components/frame: 1 of 2 - pages/inbox; components/frame is not ready until they pass',
    );
    expect(broken.code).toBe(1);
    const droppedBroken = dropped();

    expect(inspected.mock.calls.flatMap(([{ jobs }]) => jobs.flatMap((job) => job.parts ?? []))).not.toContain(
      'pages/other',
    );

    inspected.mockImplementation(async () => ({ issues: [], warnings: [], grids: [], drawn: [] }));

    const alone = await run(target, 'pages/other');

    vi.mocked(dropPartRecord).mockClear();

    const passing = await run(target, 'components/frame');

    expect(alone.lines.some((line) => line.startsWith('EMBEDDERS'))).toBe(false);
    expect(passing.lines).toContain('EMBEDDERS PASS components/frame: 2 parts');
    expect(passing.code).toBe(alone.code);
    expect(droppedBroken).toEqual([...dropped(), 'components/frame']);
  }, 30_000);
});
