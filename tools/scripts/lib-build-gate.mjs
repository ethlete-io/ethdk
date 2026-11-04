import { spawnSync } from 'node:child_process';

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

const manifestAt = (root, rev, file) => {
  const shown = spawnSync('git', ['show', `${rev}:${file}`], { cwd: root, encoding: 'utf8' });
  return shown.status === 0 ? JSON.parse(shown.stdout) : null;
};

const dependenciesOf = (manifest) => JSON.stringify(DEPENDENCY_FIELDS.map((field) => manifest?.[field] ?? {}));

/** Names of the libs whose `package.json` dependency fields differ between `base` and `head`. */
export const libsWithChangedDependencies = (root, base, head) => {
  const changed = spawnSync('git', ['diff', '--name-only', base, head, '--', 'libs/*/package.json'], {
    cwd: root,
    encoding: 'utf8',
  })
    .stdout.split('\n')
    .filter(Boolean);

  return changed
    .filter((file) => dependenciesOf(manifestAt(root, base, file)) !== dependenciesOf(manifestAt(root, head, file)))
    .filter((file) => manifestAt(root, head, file))
    .map((file) => file.split('/')[1]);
};

export const buildLibs = (root, libs) => {
  if (!libs.length) return 0;
  const run = spawnSync('npx', ['nx', 'run-many', '-t', 'build', '-p', libs.join(','), '--outputStyle=static'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' },
  });
  if (run.status === 0) return 0;
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  console.error(`lib-build-gate: build fails in ${libs.join(', ')} after a dependency change (above).`);
  return 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, head] = process.argv.slice(2);
  process.exit(buildLibs(process.cwd(), libsWithChangedDependencies(process.cwd(), base, head)));
}
