import { RemovedExport } from '../removed-exports/removed-exports.js';

const NAMES = ['UNIT_MS', 'deriveDurationFormatSpec', 'formatDuration', 'parseDuration'] as const;

export const DURATION_FORMAT_INTERNALS_REMOVALS: readonly RemovedExport[] = NAMES.map((name) => ({
  name,
  todo: `${name} is no longer exported; it is a duration input internal. Bind a duration input with a durationFormat, or format and parse the milliseconds in the app.`,
}));
