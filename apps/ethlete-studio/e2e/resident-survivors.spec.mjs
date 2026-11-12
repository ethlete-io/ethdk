import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { residentsOf, residentSurvivors, survivorLinesOf } from './resident-survivors.mjs';

const PS = [
  '  101 /usr/bin/node /x/dist/libs/cli/bin.js design __resident --checkout /tmp/studio-canvas-e2e-aaa',
  '  102 /usr/bin/node /x/dist/libs/cli/bin.js design __resident --checkout /home/human/dev/repo',
  '  103 /usr/bin/node /x/dist/libs/cli/bin.js design serve --checkout /tmp/studio-canvas-e2e-aaa',
  '  104 /usr/bin/node /x/dist/libs/cli/bin.js design __resident --checkout /tmp/studio-canvas-e2e-aaa-2',
  "  105 /bin/zsh -c ps | grep 'design __resident --checkout /tmp/studio-canvas-e2e-aaa' | head",
].join('\n');

const clock = (start = 0) => {
  let at = start;
  return { now: () => at, sleep: async (ms) => void (at += ms) };
};

test('only a resident of a run checkout counts, not a serve or the main checkout', () => {
  assert.deepEqual(residentsOf(PS, new Map([['/tmp/studio-canvas-e2e-aaa', 0]])), [
    { pid: 101, checkout: '/tmp/studio-canvas-e2e-aaa' },
  ]);
});

test('a resident that ends within the grace is no survivor', async () => {
  const { now, sleep } = clock();
  const lists = [PS, PS, ''];
  const survivors = await residentSurvivors({
    teardowns: new Map([['/tmp/studio-canvas-e2e-aaa', 0]]),
    list: () => lists.shift() ?? '',
    now,
    sleep,
    pollMs: 5_000,
  });
  assert.deepEqual(survivors, []);
});

test('a resident alive more than 15 s after its teardown is a survivor', async () => {
  const { now, sleep } = clock(1_000);
  const survivors = await residentSurvivors({
    teardowns: new Map([['/tmp/studio-canvas-e2e-aaa', 1_000]]),
    list: () => PS,
    now,
    sleep,
  });
  assert.deepEqual(survivors, [{ pid: 101, checkout: '/tmp/studio-canvas-e2e-aaa' }]);
  assert.ok(now() - 1_000 > 15_000);
  assert.ok(now() - 1_000 <= 15_250);
  assert.match(survivorLinesOf(survivors)[0], /resident 101 of \/tmp\/studio-canvas-e2e-aaa survived .* 15 s/);
});

test('the e2e runner reports each worker checkout and fails on a survivor', () => {
  const runner = readFileSync(new URL('./canvas.e2e.mjs', import.meta.url), 'utf8');
  assert.match(runner, /process\.send\(\{ type: 'checkout', checkout: realpathSync\(checkout\) \}\)/);
  assert.match(runner, /residentSurvivors\(\{ teardowns \}\)/);
  assert.match(runner, /survivors\.length/);
});
