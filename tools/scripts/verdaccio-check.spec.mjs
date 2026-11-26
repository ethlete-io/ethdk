import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verdaccioVerdictOf } from './verdaccio-check.mjs';

test('passes when the token is known and the package is served', () => {
  assert.equal(verdaccioVerdictOf({ whoamiStatus: 200, username: 'ci', packageStatus: 200 }).level, 'ok');
});

test('fails loudly when whoami refuses the token', () => {
  const verdict = verdaccioVerdictOf({ whoamiStatus: 401, packageStatus: 401 });

  assert.equal(verdict.level, 'error');
  assert.match(verdict.text, /refused the CI token/);
});

test('fails with the config hint when the package is refused to a known user', () => {
  const verdict = verdaccioVerdictOf({ whoamiStatus: 200, username: 'ci', packageStatus: 403 });

  assert.equal(verdict.level, 'error');
  assert.match(verdict.text, /@ethlete\/\* packages entry/);
});

test('only warns while the package was never published', () => {
  assert.equal(verdaccioVerdictOf({ whoamiStatus: 200, username: 'ci', packageStatus: 404 }).level, 'warning');
});
