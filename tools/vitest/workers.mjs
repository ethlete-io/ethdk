import { availableParallelism } from 'node:os';
import { refuseMissingRelatedPaths } from './related-paths.mjs';

refuseMissingRelatedPaths();

/** Vitest follows the core count by default; a big machine then starts forks that time out specs a CI runner passes. */
export const specWorkers = Math.min(4, Math.max(availableParallelism() - 1, 1));
