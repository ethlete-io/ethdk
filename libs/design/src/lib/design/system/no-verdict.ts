import { loadavg } from 'os';
import { physicalCoresOf } from '../physical-cores';

/** The answer of a check that could not run: why it could not, never a pass or a fail. */
export type NoVerdict = { noVerdict: string };

export const noVerdictOf = (why: string): NoVerdict => ({ noVerdict: why });

export const isNoVerdict = (value: unknown): value is NoVerdict =>
  typeof value === 'object' && value !== null && typeof (value as Partial<NoVerdict>).noVerdict === 'string';

/** The line a command prints for `result` about `subject`, telling the reader to run it again. */
export const noVerdictLineOf = (subject: string, result: NoVerdict) =>
  `${subject}: no verdict - ${result.noVerdict}, retry`;

const MAX_LOAD_FACTOR = 8;

/** `ms` stretched by how far the machine load exceeds its physical cores, at least `ms` and at most 8 times it. */
export const loadScaledMs = (ms: number, load = { avg1: loadavg()[0] ?? 0, cores: physicalCoresOf() }) =>
  Math.round(ms * Math.min(MAX_LOAD_FACTOR, Math.max(1, load.avg1 / Math.max(1, load.cores))));
