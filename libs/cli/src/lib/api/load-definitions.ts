import { existsSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import { ApiDefinitions } from './definition';

export const API_DEFINITIONS_FILE_NAMES = ['ethlete.apis.js', 'ethlete.apis.cjs'];

export type LoadApiDefinitionsResult =
  { found: true; apis: ApiDefinitions; fileName: string } | { found: false; apis?: undefined; fileName?: undefined };

/**
 * Loads the repo's API definitions from `ethlete.apis.js`. The file is a module rather than JSON
 * because a definition's `env` is a function, which JSON cannot hold.
 */
export const loadApiDefinitions = (root: string): LoadApiDefinitionsResult => {
  const fileName = API_DEFINITIONS_FILE_NAMES.find((candidate) => existsSync(join(root, candidate)));

  if (!fileName) return { found: false };

  const loaded: unknown = createRequire(join(root, 'package.json'))(join(root, fileName));
  const apis = (loaded as { default?: ApiDefinitions }).default ?? (loaded as ApiDefinitions);

  return { found: true, apis, fileName };
};
