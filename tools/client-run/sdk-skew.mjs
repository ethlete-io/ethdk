import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SDK_LIBS = ['types', 'bracket', 'core', 'query', 'components', 'cli', 'agent-rules'];

const versionOf = (dir) => {
  const file = join(dir, 'package.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).version : null;
};

/** Lists the libs whose copy in the target's node_modules differs from the SDK build in `sdk/dist/libs`. */
export const skewOf = ({ target, sdk }) =>
  SDK_LIBS.flatMap((lib) => {
    const built = versionOf(join(sdk, 'dist/libs', lib));
    if (!built) return [];
    const installed = versionOf(join(target, 'node_modules/@ethlete', lib));
    return installed === built ? [] : [{ lib, installed, built }];
  });
