import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cliFreshnessOf } from './cli-fresh.mjs';

const check = (version, newest) => cliFreshnessOf({ version, source: 'the sdk build', newest });

describe('cliFreshnessOf', () => {
  it('refuses a cli older than the newest @next and names both versions', () => {
    const result = check('1.0.0-next.26', '1.0.0-next.44');
    assert.equal(result.ok, false);
    assert.match(result.message, /next\.26/);
    assert.match(result.message, /next\.44/);
    assert.match(result.message, /yarn install/);
  });

  it('compares prerelease numbers, not strings', () => {
    assert.equal(check('1.0.0-next.9', '1.0.0-next.10').ok, false);
    assert.equal(check('1.0.0-next.10', '1.0.0-next.9').ok, true);
  });

  it('passes the same or a newer cli', () => {
    assert.deepEqual(check('1.0.0-next.44', '1.0.0-next.44'), { ok: true, message: null });
    assert.equal(check('1.0.1-next.1', '1.0.0-next.44').ok, true);
  });

  it('warns and passes when npm is unreachable', () => {
    const result = check('1.0.0-next.26', null);
    assert.equal(result.ok, true);
    assert.match(result.message, /unreachable/);
  });
});
