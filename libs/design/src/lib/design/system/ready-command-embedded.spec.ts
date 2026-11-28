import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { buildReadyOf } from './part-build-ready';
import { readyInputsOf } from './ready-command';
import { isNoVerdict } from './no-verdict';
import { resolveProduct } from './resolve-product';
import { runSlowChecks } from './slow-run';

vi.mock('./slow-run', async (actual) => ({
  ...(await actual<typeof import('./slow-run')>()),
  runSlowChecks: vi.fn(async () => new Map()),
}));

vi.mock('./drawn-open-points', async (actual) => ({
  ...(await actual<typeof import('./drawn-open-points')>()),
  drawnFindingsOf: vi.fn(async () => ({ issues: [], missingStates: [], busyStates: [] })),
}));

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-ready-embedded-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  mkdirSync(join(target, 'apps/app-a/src'), { recursive: true });
  writeFileSync(
    join(target, 'apps/app-a/src/chip.component.ts'),
    "@Component({ selector: 'app-chip' })\nexport class Chip {}\n",
  );
  part(
    'components/chip',
    "export default definePart({ implements: 'apps/app-a/src/chip.component.ts', states: { default: {} } });\n",
  );
  part(
    'pages/home',
    "import chip from '@system/components/chip';\nexport default definePart({ states: { default: { chip } } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

describe('readyInputsOf embedded slow checks', () => {
  it('runs the slow checks of the host and of each embedded part whose result is pending', async () => {
    const target = checkout();
    const product = resolveProduct({
      target,
      name: 'app-a',
      config: { harness: { app: 'apps/app-a', map: 'apps/app-a/src/map.ts' } },
    });

    const inputs = await readyInputsOf({ target, config: {}, product, part: 'pages/home' });

    if (isNoVerdict(inputs)) throw new Error(inputs.noVerdict);

    const parts = vi.mocked(runSlowChecks).mock.calls.flatMap(([call]) => call.parts ?? []);

    expect(parts.sort()).toEqual(['components/chip', 'pages/home']);
  });

  it('names why a pending part is not build-ready', () => {
    const target = checkout();
    const product = resolveProduct({
      target,
      name: 'app-a',
      config: { harness: { app: 'apps/app-a', map: 'apps/app-a/src/map.ts' } },
    });
    const inputs = { pointsOf: () => [], problemsOf: () => [], slowOf: () => 'pending' as const };
    const verdict = buildReadyOf({ product, part: 'pages/home', inputs });

    expect(JSON.stringify(verdict)).toContain('slow checks have not run');
    expect(JSON.stringify(verdict)).toMatch(/components\/chip is not build-ready: .*slow checks have not run/u);
  });
});
