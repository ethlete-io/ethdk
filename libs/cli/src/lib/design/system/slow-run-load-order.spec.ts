import '../status';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { resolveProduct } from './resolve-product';
import { runSlowChecks } from './slow-run';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-slow-load-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'apps/acme/src'), { recursive: true });
  writeFileSync(
    join(target, 'apps/acme/src/chip.component.ts'),
    "@Component({ selector: 'acme-chip', template: '' })\nexport class Chip {}\n",
  );

  const chip = join(target, DESIGN_DIR, 'acme/components/chip');

  mkdirSync(chip, { recursive: true });
  writeFileSync(
    join(chip, 'chip.ts'),
    "export default definePart({ implements: 'apps/acme/src/chip.component.ts', states: { default: {} } });\n",
  );

  return {
    target,
    product: resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} }),
  };
};

describe('the slow runner loaded the way the CLI loads it', { timeout: 60_000 }, () => {
  it('runs the default DROPPED-PROP runner although dropped-props is still loading when slow-run loads', async () => {
    const { target, product } = acme();

    await expect(
      runSlowChecks({
        target,
        config: readConfig(target) ?? {},
        product,
        parts: ['components/chip'],
        runners: {
          controlState: async () => [],
          contrastPairs: async () => [],
          actionLost: async () => [],
          pageStateInner: async () => [],
        },
      }),
    ).resolves.toBeInstanceOf(Map);
  });
});
