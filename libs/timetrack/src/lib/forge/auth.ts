import { Observable, catchError, map, of } from 'rxjs';
import { TimetrackProcessRunner } from '../transport/ports';
import { ForgeCli, forgeHostname, isMissingCliError } from './cli';

/** One host the CLI holds a credential for, and the account name it holds it under. */
export type ForgeLogin = { host: string; login: string };

/**
 * What a shell-out source can be, and why the three are not one.
 *
 * A shell-out trades a token the app stores for a binary on the `PATH` and a login performed
 * elsewhere. Both can go away silently, so a source that cannot tell them apart trades a visible
 * token expiry for an invisible one.
 */
export type ForgeAuthState = 'not-installed' | 'not-logged-in' | 'logged-in';

export type ForgeAuth = {
  cli: ForgeCli;
  state: ForgeAuthState;
  logins: ForgeLogin[];
};

/**
 * `glab` writes `Logged in to <host> as <login> (keyring)` and `gh` writes
 * `Logged in to <host> account <login> (keyring)`. Both give the account name, which `gh` needs to
 * ask for the right events feed.
 */
const LOGGED_IN = /Logged in to (\S+) (?:as|account) (\S+)/;

/**
 * The hosts a status report says the CLI is logged in to.
 *
 * The exit code is deliberately not read: `glab auth status` exits non-zero when any one configured
 * host fails, so a machine with a working self-hosted instance and no `gitlab.com` token would be
 * reported as broken. The per-host lines are the only truthful source.
 */
export const parseForgeAuthStatus = (report: string): ForgeLogin[] => {
  const logins: ForgeLogin[] = [];

  for (const line of report.split('\n')) {
    const found = LOGGED_IN.exec(line);

    if (found?.[1] && found[2]) logins.push({ host: found[1], login: found[2] });
  }

  return logins;
};

/**
 * Asks the CLI what it is logged in to.
 *
 * Both streams are read: `glab auth status` writes its whole report to stderr and leaves stdout empty,
 * and `gh auth status` writes to stdout.
 */
export const probeForgeAuth$ = (options: { runner: TimetrackProcessRunner; cli: ForgeCli }): Observable<ForgeAuth> =>
  options.runner.run$({ command: options.cli, args: ['auth', 'status'] }).pipe(
    map((result): ForgeAuth => {
      const logins = parseForgeAuthStatus(`${result.stdout}\n${result.stderr}`);

      return { cli: options.cli, state: logins.length > 0 ? 'logged-in' : 'not-logged-in', logins };
    }),
    catchError((error: unknown) => {
      if (isMissingCliError(error)) return of<ForgeAuth>({ cli: options.cli, state: 'not-installed', logins: [] });

      throw error;
    }),
  );

/** The credential for one host, or `null` when the CLI holds none for it. */
export const forgeLoginFor = (auth: ForgeAuth, host: string) => {
  const wanted = forgeHostname(host).toLowerCase();

  return auth.logins.find((login) => login.host.toLowerCase() === wanted) ?? null;
};
