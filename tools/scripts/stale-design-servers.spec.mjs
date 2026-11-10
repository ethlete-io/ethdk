import assert from 'node:assert/strict';
import { test } from 'node:test';
import { etimeSeconds, staleDesignServers, staleServerWarnings } from './stale-design-servers.mjs';

const PS = `  PID     ELAPSED COMMAND
    1 38-07:04:01 /sbin/launchd
65717  1-12:03:10 node node_modules/.cache/a-cli/src/index.js design /var/folders/zz/abc/T/x
20479       00:01 node -e setTimeout(()=>{},8000) index.js design /var/folders/zz/abc/T/x
20480       59:59 node /Users/tom/dev/ethlete-sdk/node_modules/.cache/a-cli/src/index.js design /tmp/y
20481    02:00:00 node /Users/tom/dev/ethlete-sdk/dist/libs/cli/src/index.js design /tmp/z
30000    02:00:00 node /Users/other/dev/elsewhere/dist/index.js design /tmp/z
`;

test('parses ps elapsed times', () => {
  assert.equal(etimeSeconds('00:01'), 1);
  assert.equal(etimeSeconds('02:00:00'), 7200);
  assert.equal(etimeSeconds('1-12:03:10'), 129790);
});

test('lists design servers of the checkout older than an hour', () => {
  const found = staleDesignServers(PS, { root: '/Users/tom/dev/ethlete-sdk' });

  assert.deepEqual(
    found.map((server) => server.pid),
    [65717, 20481],
  );
});

test('one warning line per server, with pid and age', () => {
  const lines = staleServerWarnings(staleDesignServers(PS, { root: '/Users/tom/dev/ethlete-sdk' }));

  assert.equal(lines.length, 2);
  assert.match(lines[0], /pid 65717 has run for 1-12:03:10/);
});
