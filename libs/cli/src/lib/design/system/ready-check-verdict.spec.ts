import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { partActionFailuresOf } from './actions-command';
import { recordCheckedBuildReady } from './check-record';
import { buildReadyInputsOf } from './check-system';
import { drawnFindingsOf } from './drawn-open-points';
import { readyMarkOf, writePartRecord } from './part-ready';
import { readOpenPoints } from './read-open-points';
import { designReady } from './ready-command';
import { resolveProduct } from './resolve-product';
import { originOf } from './write-origin';

vi.mock('./drawn-open-points', () => ({
  drawnFindingsOf: vi.fn(async () => ({ missingStates: [], busyStates: [], issues: [] })),
}));

vi.mock('./actions-command', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions-command')>()),
  partActionFailuresOf: vi.fn(async () => []),
}));

vi.mock('./action-lost', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./action-lost')>()),
  declaredPartActionsOf: vi.fn(async () => []),
}));

vi.mock('./harness-map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./harness-map')>()),
  refreshHarnessMap: vi.fn(() => false),
}));

vi.mock('./slow-checks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./slow-checks')>()),
  slowProblemsOf: vi.fn(() => []),
}));

const CHIP = 'components/chip';
const HOME = 'pages/home';
const harness = { app: 'apps/a', map: 'apps/a/harness.ts' };

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-ready-check-verdict-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part(
    CHIP,
    "export default definePart({ controls: { remove: {} }, describe: { default: 'at rest' }, states: { default: {} } });\n",
  );
  part(
    HOME,
    "import chip from '@system/components/chip';\nexport default definePart({ controls: { open: {} }, describe: { default: 'at rest' }, states: { default: { chip } } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': { harness } } }));

  return target;
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: { harness } });

type Case = {
  name: string;
  part: string;
  recorded: string[];
  missing?: { part: string; control: string }[];
};

type Verdict = { pass: boolean; marked: boolean };

const drawn = (found: Case) => ({ missingStates: found.missing ?? [], busyStates: [] });

const arrange = (found: Case) => {
  const target = checkout();

  for (const part of found.recorded) writePartRecord({ product: productOf(target), part, origin: originOf('spec') });

  vi.mocked(drawnFindingsOf).mockResolvedValue({ ...drawn(found), issues: [] });

  return target;
};

const verdictOf = (target: string, part: string, pass: boolean): Verdict => ({
  pass,
  marked: readyMarkOf({ product: productOf(target), part }) !== null,
});

const ready = async (found: Case): Promise<Verdict> => {
  const target = arrange(found);
  const code = await designReady({
    target,
    argv: [found.part, '--product', 'app-a', '--by', 'spec'],
    invocation: 'et design',
  });

  return verdictOf(target, found.part, code === 0);
};

const check = async (found: Case): Promise<Verdict> => {
  const target = arrange(found);
  const config = readConfig(target) ?? {};
  const product = productOf(target);
  const recorded = await recordCheckedBuildReady({
    target,
    config,
    settle: [],
    product,
    parts: [found.part],
    inputs: buildReadyInputsOf(product, { points: readOpenPoints(product, drawn(found)) }),
    actionsOf: (part) => partActionFailuresOf({ target, config, product, part }),
    declaredActionsOf: async () => [],
  });

  return verdictOf(target, found.part, recorded.get(found.part)?.ready === true);
};

const CASES: Case[] = [
  { name: 'a green part without a record', part: CHIP, recorded: [] },
  { name: 'a green part with a holding record', part: CHIP, recorded: [CHIP] },
  {
    name: 'a part with an open point and no record',
    part: CHIP,
    recorded: [],
    missing: [{ part: CHIP, control: 'remove' }],
  },
  {
    name: 'a part with a holding record and an open point',
    part: CHIP,
    recorded: [CHIP],
    missing: [{ part: CHIP, control: 'remove' }],
  },
  { name: 'a green host whose embedded part has no record', part: HOME, recorded: [] },
  { name: 'a green host whose embedded part is build-ready', part: HOME, recorded: [CHIP] },
  {
    name: 'a host with a holding record whose embedded part has an open point',
    part: HOME,
    recorded: [CHIP, HOME],
    missing: [{ part: CHIP, control: 'remove' }],
  },
];

describe('design ready and design check reach one build-ready verdict', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(CASES)(
    '$name',
    async (found) => {
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const checked = await check(found);

      expect(await ready(found)).toEqual(checked);
    },
    60_000,
  );
});
