import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [target] = process.argv.slice(2);

if (!target) throw new Error('usage: write-build-info.mts <target>');

writeFileSync(join(resolve(target), 'build-info.json'), `${JSON.stringify({ builtAt: new Date().toISOString() })}\n`);
