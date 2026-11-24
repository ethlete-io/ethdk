import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registerInStudio } from './studio-register.mjs';

describe('registerInStudio', () => {
  it('asks Studio to open the run checkout from outside the sandbox', () => {
    const calls = [];
    const status = registerInStudio({
      target: '/runs/2026-11-24-1642/tomflix',
      spawn: (command, args, options) => {
        calls.push({ command, args, options });
        return { status: 0 };
      },
    });

    assert.equal(status, 0);
    assert.deepEqual(calls[0].args.slice(1), ['design', 'studio', 'open', '/runs/2026-11-24-1642/tomflix']);
    assert.equal(calls[0].options.env.CLEAN_SLATE_SANDBOX, '');
  });
});
