/* eslint-disable @typescript-eslint/naming-convention -- Both forges take snake_case query parameters. */
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { ProcessResult, TimetrackProcessRunner } from '../transport/ports';

/**
 * A command-line client that speaks a forge's REST API under a login the app never sees.
 *
 * `gh` is `glab`'s ancestor, so both hold their own credential, both print the API's own JSON body on
 * stdout, and both report an HTTP error on stderr as `<cli>: <message> (HTTP <code>)`. That one shared
 * convention is what lets a single transport serve GitLab and GitHub.
 */
export type ForgeCli = 'glab' | 'gh';

/** The host reports a missing binary with this prefix, and with no other failure. */
const NOT_INSTALLED_PREFIX = 'not installed: ';

/** The CLI ran and the forge refused, or could not be reached. `status` is 0 when no request was made. */
export class ForgeRequestError extends Error {
  readonly cli: ForgeCli;
  readonly status: number;
  readonly describe: string;

  constructor(options: { cli: ForgeCli; status: number; describe: string; message: string }) {
    super(options.message);
    this.name = 'ForgeRequestError';
    this.cli = options.cli;
    this.status = options.status;
    this.describe = options.describe;
  }
}

/**
 * The bare hostname a CLI takes, out of whatever a settings field holds.
 *
 * The GitLab setting is a host the transport turned into a base URL, so it may carry a scheme and a
 * trailing slash. `--hostname https://git.example.com/` reaches nothing, and a login line — which
 * reports the bare host — would never match it either.
 */
export const forgeHostname = (host: string) =>
  host
    .trim()
    .replace(/^[a-z+]+:\/\//i, '')
    .replace(/\/.*$/, '');

export type ForgeQuery = Record<string, string | number | boolean | undefined>;

const withQuery = (path: string, query: ForgeQuery | undefined) => {
  const params = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);

  return params.length === 0
    ? path
    : `${path}?${params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`;
};

const HTTP_STATUS = /\(HTTP (\d{3})\)\s*$/m;

/**
 * A transport failure prints a boxed `ERROR` block rather than the status line, so the box furniture
 * is what has to come off before the sentence inside it can be shown to anybody.
 */
const transportMessageOf = (stderr: string) =>
  stderr
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== 'ERROR')
    .join(' ')
    .replace(/\s+/g, ' ');

const messageFor = (options: { cli: ForgeCli; status: number; describe: string; stderr: string }) => {
  const { cli, status, describe } = options;

  if (status === 401) return `\`${cli}\` is not logged in, so it could not read ${describe}.`;
  if (status === 403) return `The \`${cli}\` login may not read ${describe}.`;
  if (status === 404) return `There is no ${describe}, or the \`${cli}\` login cannot see it.`;
  if (status === 429) return `The forge rate-limited the request for ${describe}.`;
  if (status > 0) return `The forge answered ${status} for ${describe}.`;

  return `\`${cli}\` could not reach the forge for ${describe}: ${transportMessageOf(options.stderr)}`;
};

const failureOf = (options: { cli: ForgeCli; describe: string; result: ProcessResult }) => {
  const status = Number(HTTP_STATUS.exec(options.result.stderr)?.[1] ?? 0);

  return new ForgeRequestError({
    cli: options.cli,
    status,
    describe: options.describe,
    message: messageFor({ cli: options.cli, status, describe: options.describe, stderr: options.result.stderr }),
  });
};

export type ForgeApiCall = {
  runner: TimetrackProcessRunner;
  cli: ForgeCli;
  /**
   * The instance to talk to. `glab` otherwise picks its host from the working directory, and falls
   * back to `gitlab.com` — and a collector has no meaningful working directory, so every call names it.
   */
  hostname: string;
  /** A REST v4 path, leading slash included. */
  path: string;
  query?: ForgeQuery;
  /** What the call was for, in a sentence a failure can be read into. */
  describe: string;
};

/** Runs one API call through the CLI and parses its body. */
export const forgeApi$ = <T>(call: ForgeApiCall): Observable<T> =>
  call.runner
    .run$({
      command: call.cli,
      args: ['api', '--hostname', call.hostname, withQuery(call.path, call.query).replace(/^\//, '')],
    })
    .pipe(
      map((result) => {
        if (result.code !== 0) throw failureOf({ cli: call.cli, describe: call.describe, result });

        try {
          return JSON.parse(result.stdout) as T;
        } catch {
          throw new ForgeRequestError({
            cli: call.cli,
            status: 0,
            describe: call.describe,
            message: `\`${call.cli}\` returned something that is not JSON for ${call.describe}.`,
          });
        }
      }),
    );

export type ForgePagingOptions = {
  /** Items per request. Both forges cap this at 100. */
  pageSize: number;
  /** A wide window must not page forever against a rate-limited instance. */
  maxPages: number;
};

export const DEFAULT_FORGE_PAGING_OPTIONS: ForgePagingOptions = {
  pageSize: 100,
  maxPages: 20,
};

/**
 * Every page of a list endpoint, concatenated.
 *
 * Paging is done here rather than with `--paginate`, which emits one JSON array per page instead of the
 * single array its help text promises, and which has no way to express a cap. A page shorter than
 * `pageSize` is the last one; a forge that fills the last page exactly costs one more empty call.
 */
export const forgeApiPaged$ = <T>(call: ForgeApiCall & { paging?: Partial<ForgePagingOptions> }): Observable<T[]> => {
  const { pageSize, maxPages } = { ...DEFAULT_FORGE_PAGING_OPTIONS, ...call.paging };
  const page$ = (page: number) => forgeApi$<T[]>({ ...call, query: { ...call.query, per_page: pageSize, page } });

  return page$(1).pipe(
    expand((items, index) => (items.length >= pageSize && index < maxPages - 1 ? page$(index + 2) : EMPTY)),
    reduce((all: T[], items) => [...all, ...(Array.isArray(items) ? items : [])], []),
  );
};

/**
 * Whether the failure is the binary being absent, which every caller reports differently from a refusal.
 *
 * The host has one channel to say it in — the serialized error string — so the prefix it writes is the
 * contract. See `TimetrackError::NotInstalled`.
 */
export const isMissingCliError = (error: unknown) =>
  error instanceof Error && error.message.startsWith(NOT_INSTALLED_PREFIX);
