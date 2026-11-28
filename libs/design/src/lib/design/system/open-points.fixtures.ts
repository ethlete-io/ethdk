import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll } from 'vitest';
import { readConfig } from '../design-config';
import { openPointsInWorker, stopOpenPointsWorkers } from './open-points-runner';
import { resolveProduct } from './resolve-product';

export { openPointsAnswer } from '../studio-api';
export { openPointsInWorker } from './open-points-runner';

const WARM_TIMEOUT = 120_000;

// The jiti cold start of the worker takes about 2 s unloaded and past 30 s on a busy CI runner; a case timeout cannot hold it.
beforeAll(async () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-warm-worker-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

  await openPointsInWorker({ product, part: null });
}, WARM_TIMEOUT);

afterAll(() => stopOpenPointsWorkers());
