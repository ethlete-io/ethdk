import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { SDK_LIBS, skewOf } from './sdk-skew.mjs';

const repo = resolve(import.meta.dirname, '../..');
const run1751 = join(process.env.HOME ?? '', 'dev/client-runs/2026-11-24-1751/tomflix');

const writeLib = (root, lib, version) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: `@ethlete/${lib}`, version }));
};

describe('skewOf', () => {
  it('reports components of the real run 2026-11-24-1751 (next.79 next to cli next.44)', () => {
    const skew = skewOf({ target: run1751, sdk: repo });
    assert.deepEqual(skew.find((s) => s.lib === 'components')?.installed, '1.0.0-next.79');
    assert.equal(
      skew.find((s) => s.lib === 'cli'),
      undefined,
    );
  });

  it('is empty after install-sdk.sh on that setup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skew-'));
    const sdk = join(dir, 'sdk');
    const target = join(dir, 'target');
    for (const lib of SDK_LIBS) {
      writeLib(join(sdk, 'dist/libs', lib), lib, '9.0.0-next.98');
      writeLib(join(target, 'node_modules/@ethlete', lib), lib, lib === 'cli' ? '9.0.0-next.98' : '9.0.0-next.79');
    }
    assert.ok(skewOf({ target, sdk }).length > 0);
    execFileSync('bash', [join(repo, 'tools/scripts/clean-slate-run/install-sdk.sh'), sdk, target]);
    assert.deepEqual(skewOf({ target, sdk }), []);
  });
});
