import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered } from './check-system';
import { renderIssuesOf } from './render-check';

vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: vi.fn(async () => ({ issues: [], warnings: [], grids: [], drawn: [] })),
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

const PARTS: Record<string, string> = {
  'components/frame': `import { definePart, drawing, html } from '@design-system';

export const frameBox = (label: string) => html\`<i class="frame">\${label}</i>\`;
export const frameStyles = '.frame { color: red; }';

export default definePart({
  note: 'The edited part.',
  states: { default: {} },
  describe: { default: 'The frame alone.' },
  render: () => drawing({ body: frameBox('alone'), styles: '' }),
});
`,
  'elements/holder': `import { definePart, drawing, html } from '@design-system';
import { frameBox } from '@system/components/frame';

export const holderBox = (framed: boolean) => html\`<div class="holder">\${framed ? frameBox('held') : 'empty'}</div>\`;

export default definePart({
  note: 'Embeds the frame in one state.',
  states: { framed: { framed: true }, empty: { framed: false } },
  describe: { framed: 'Holds the frame.', empty: 'Holds nothing.' },
  render: ({ framed }: { framed: boolean }) => drawing({ body: holderBox(framed), styles: '' }),
});
`,
  'pages/inbox': `import { definePart, drawing, html } from '@design-system';
import { frameBox } from '@system/components/frame';
import { holderBox } from '@system/elements/holder';

type Props = { show: 'direct' | 'nested' | 'none' | 'broken' };

const bodyOf = ({ show }: Props) => {
  if (show === 'broken') throw new Error('needs a browser');

  return show === 'direct' ? frameBox('direct') : show === 'nested' ? holderBox(true) : holderBox(false);
};

export default definePart({
  note: 'Embeds the frame in some states.',
  states: { direct: { show: 'direct' }, nested: { show: 'nested' }, bare: { show: 'none' }, broken: { show: 'broken' } },
  describe: { direct: 'The frame.', nested: 'The frame in a holder.', bare: 'An empty holder.', broken: 'Throws outside a browser.' },
  render: (props: Props) => drawing({ body: html\`<main>\${bodyOf(props)}</main>\`, styles: '' }),
});
`,
  'pages/plain': `import { definePart, drawing, html } from '@design-system';
import { frameStyles } from '@system/components/frame';

export default definePart({
  note: 'Takes only the styles of the frame.',
  states: { default: {} },
  describe: { default: 'No frame.' },
  render: () => drawing({ body: html\`<main>plain</main>\`, styles: frameStyles }),
});
`,
};

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-embedder-states-'));
  const design = join(target, DESIGN_DIR);

  for (const [key, source] of Object.entries(PARTS)) {
    const dir = join(design, 'app-a', key);

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${key.split('/')[1]}.ts`), source);
  }

  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

const run = async (target: string, part: string) => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);
  vi.spyOn(console, 'warn').mockImplementation(push);

  const code = await checkSystemRendered({ target, config: readConfig(target) ?? {}, products: ['app-a'], part });

  return { code, lines };
};

const onlyOf = (part: string) =>
  vi
    .mocked(renderIssuesOf)
    .mock.calls.flatMap(([{ jobs }]) => jobs)
    .filter((job) => job.parts?.includes(part))
    .map((job) => job.only?.[part] ?? null);

describe('design check --part draws an embedder only in the states that hold the part', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(renderIssuesOf).mockClear();
  });

  it('draws the states that hold the part directly or through a nested part, and fails on a problem in one', async () => {
    const target = checkout();

    vi.mocked(renderIssuesOf).mockImplementation(async ({ jobs }) => ({
      issues: jobs.some((job) => job.parts?.includes('pages/inbox') && job.only?.['pages/inbox']?.includes('nested'))
        ? [
            {
              rule: 'COVERED',
              product: 'app-a',
              part: 'pages/inbox',
              state: 'nested',
              size: 'm',
              path: 'i',
              detail: 'covered by a sibling',
              sketch: null,
            },
          ]
        : [],
      warnings: [],
      grids: [],
      drawn: [],
    }));

    const { code, lines } = await run(target, 'components/frame');

    expect(onlyOf('pages/inbox')).toEqual([['direct', 'nested', 'broken']]);
    expect(onlyOf('elements/holder')).toEqual([['framed']]);
    expect(onlyOf('pages/plain')).toEqual([[]]);
    expect(onlyOf('components/frame')).toEqual([null]);
    expect(lines).toContainEqual(expect.stringMatching(/^PART app-a pages\/inbox: 1 problem \(COVERED\)/u));
    expect(lines).toContain(
      'EMBEDDERS FAIL components/frame: 1 of 3 - pages/inbox; components/frame is not ready until they pass',
    );
    expect(code).toBe(1);
  }, 60_000);
});
