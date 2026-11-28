import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

type SourceHashes = { cliSourceHash: (root: string) => string; designSourceHash: (root: string) => string };

const HASHES = { cli: 'cliSourceHash', design: 'designSourceHash' } as const;

/**
 * Writes `<target>/build-info.json` for the build in `target`, with the hash of the sources in `sourceRoot`
 * (`libs/cli` or `libs/design`). `target` must hold the built `src/lib/source-hash.js`.
 */
export const writeBuildInfo = (target: string, sourceRoot: string, kind: keyof typeof HASHES) => {
  const hashes = createRequire(import.meta.url)(join(resolve(target), 'src/lib/source-hash.js')) as SourceHashes;
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(sourceRoot), encoding: 'utf8' });
  const commit = head.status === 0 ? head.stdout.trim() : null;
  const sourceHash = hashes[HASHES[kind]](resolve(sourceRoot));

  writeFileSync(
    join(resolve(target), 'build-info.json'),
    `${JSON.stringify({ builtAt: new Date().toISOString(), commit, sourceHash })}\n`,
  );
};

if (import.meta.main) {
  const [target, sourceRoot = 'libs/cli', kind = 'cli'] = process.argv.slice(2);

  if (!target || !(kind in HASHES)) throw new Error('usage: write-build-info.mts <target> [sourceRoot] [cli|design]');

  writeBuildInfo(target, sourceRoot, kind as keyof typeof HASHES);
}
