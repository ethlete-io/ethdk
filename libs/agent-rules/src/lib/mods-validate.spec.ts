import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const pluginsDir = resolve(__dirname, '../../content/mods/plugins');
const hasClaude = spawnSync('claude', ['--version']).status === 0;

describe.skipIf(!hasClaude)('mods validate', () => {
  for (const mod of readdirSync(pluginsDir)) {
    it(`${mod} passes claude plugin validate`, () => {
      const { stdout, stderr, status } = spawnSync('claude', ['plugin', 'validate', resolve(pluginsDir, mod)], {
        encoding: 'utf8',
      });
      expect(`${stdout}${stderr}`).not.toContain('Validation failed');
      expect(status).toBe(0);
    }, 60_000);
  }
});
