import { gitOrNull } from './base-checkout';
import { PartImplemented } from './part-task';

const DRIFT_COMMITS_SHOWN = 10;

/** The lines that say which commits touched a drifting part's app files since its implemented record. */
export const driftLinesOf = (options: { sha: string; at: string; log: string }) => {
  const commits = options.log.split('\n').filter((line) => line.trim() !== '');
  const since = `drift since ${options.sha} (${options.at})`;

  return commits.length === 0
    ? [`${since}: no commit touched the app files (a design-side change?)`]
    : [
        `${since}: ${commits.length} commit(s) touched the app files`,
        ...commits.slice(0, DRIFT_COMMITS_SHOWN).map((line) => `  ${line}`),
        ...(commits.length > DRIFT_COMMITS_SHOWN ? [`  and ${commits.length - DRIFT_COMMITS_SHOWN} older`] : []),
      ];
};

/** The drift lines of a part with an implemented record, or none when git cannot name the record's commit. */
export const driftSinceOf = (options: { root: string; record: PartImplemented | undefined; files: string[] }) => {
  const { record } = options;

  if (!record) return [];

  const sha = gitOrNull(options.root, ['rev-list', '-1', '--abbrev-commit', `--before=${record.at}`, 'HEAD'])?.trim();

  if (!sha) return [];

  const files = Object.keys(record.app);
  const paths = files.length > 0 ? files : options.files;
  const log =
    paths.length === 0
      ? ''
      : (gitOrNull(options.root, ['log', '--format=%h %s', `${sha}..HEAD`, '--', ...paths]) ?? '');

  return driftLinesOf({ sha, at: record.at, log });
};
