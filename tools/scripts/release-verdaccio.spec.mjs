import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verdaccioEnvOf } from './release-verdaccio.mjs';

test('points fetch and publish at Verdaccio with the token and no provenance', () => {
  assert.deepEqual(verdaccioEnvOf({ VERDACCIO_URL: 'http://78.46.42.73:54873/', VERDACCIO_TOKEN: 'secret' }), {
    YARN_NPM_REGISTRY_SERVER: 'http://78.46.42.73:54873',
    YARN_NPM_PUBLISH_REGISTRY: 'http://78.46.42.73:54873',
    YARN_NPM_AUTH_TOKEN: 'secret',
    YARN_NPM_PUBLISH_PROVENANCE: 'false',
    YARN_UNSAFE_HTTP_WHITELIST: '78.46.42.73',
  });
});

test('whitelists no host for an https registry', () => {
  const env = verdaccioEnvOf({ VERDACCIO_URL: 'https://npm.example.com', VERDACCIO_TOKEN: 'secret' });

  assert.equal(env.YARN_UNSAFE_HTTP_WHITELIST, undefined);
  assert.equal(env.YARN_NPM_REGISTRY_SERVER, 'https://npm.example.com');
});

test('fails without a url or a token', () => {
  assert.throws(() => verdaccioEnvOf({ VERDACCIO_TOKEN: 'secret' }), /VERDACCIO_URL/);
  assert.throws(
    () => verdaccioEnvOf({ VERDACCIO_URL: 'http://78.46.42.73:54873', VERDACCIO_TOKEN: ' ' }),
    /VERDACCIO_TOKEN/,
  );
});
