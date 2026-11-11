import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';

const script = join(import.meta.dirname, 'ci-apt-retry.sh');
const created = [];

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const FETCH_404 =
  'E: Failed to fetch http://azure.archive.ubuntu.com/ubuntu/pool/main/libs/libsoup3/libsoup-3.0-dev_3.6.6-1ubuntu0.1_amd64v3.deb  404  Not Found [IP: 20.0.0.1 80]';

const run = (failures) => {
  const dir = mkdtempSync(join(tmpdir(), 'apt-retry-'));
  created.push(dir);
  const counter = join(dir, 'installs');
  writeFileSync(counter, '');
  writeFileSync(
    join(dir, 'sudo'),
    `#!/usr/bin/env bash\nif [ "$1" = tee ]; then cat >/dev/null; exit 0; fi\nexec "$@"\n`,
  );
  writeFileSync(
    join(dir, 'apt-get'),
    `#!/usr/bin/env bash
if [ "$1" = update ]; then exit 0; fi
echo x >> "${counter}"
if [ "$(wc -l < "${counter}")" -le ${failures} ]; then echo '${FETCH_404}'; exit 100; fi
exit 0
`,
  );
  chmodSync(join(dir, 'sudo'), 0o755);
  chmodSync(join(dir, 'apt-get'), 0o755);

  const result = spawnSync('bash', [script, 'apt-get', 'install', '-y', 'libsoup-3.0-dev'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      ETHLETE_APT_RETRY_DELAY: '0',
      ETHLETE_APT_CONF_DIR: dir,
    },
  });

  return { result, tries: readFileSync(counter, 'utf8').split('\n').filter(Boolean).length };
};

test('succeeds on the third try after two 404s', () => {
  const { result, tries } = run(2);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(tries, 3);
});

test('exits non-zero and names the package and the mirror when every try fails', () => {
  const { result, tries } = run(99);
  assert.equal(result.status, 1);
  assert.equal(tries, 3);
  assert.match(
    result.stdout,
    /::error title=apt failed after 3 tries::.*libsoup-3\.0-dev_3\.6\.6-1ubuntu0\.1_amd64v3\.deb/,
  );
  assert.match(result.stdout, /azure\.archive\.ubuntu\.com/);
});
