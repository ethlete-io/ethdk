import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registerInStudio, registrationOutcomeOf } from './studio-register.mjs';

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

  it('fails the run when Studio did not take it, as in run 2026-11-25-0236', () => {
    const outcome = registrationOutcomeOf(1);

    assert.equal(outcome.exitCode, 1);
    assert.match(outcome.line, /Studio did not take the run \(exit 1\)/);
  });

  it('keeps the run green when Studio took it', () => {
    assert.equal(registrationOutcomeOf(0).exitCode, 0);
  });
});
