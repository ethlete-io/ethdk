import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const [target, cliRoot = 'libs/cli'] = process.argv.slice(2);

if (!target) throw new Error('usage: write-build-info.mts <target> [cliRoot]');

const { cliSourceHash } = createRequire(import.meta.url)(join(resolve(target), 'src/lib/source-hash.js')) as {
  cliSourceHash: (root: string) => string;
};

writeFileSync(
  join(resolve(target), 'build-info.json'),
  `${JSON.stringify({ builtAt: new Date().toISOString(), sourceHash: cliSourceHash(resolve(cliRoot)) })}\n`,
);
