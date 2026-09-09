import { ProcessResult, ProcessSpec } from '@ethlete/timetrack';
import { respondGitLab } from './gitlab';
import { FakeRoutedRequest } from './route';
import { FakeBackend } from './types';

/** What the seeded `glab` binary is, so a spec can drive the three states a shell-out source has. */
export type FakeGlabState = {
  /** `false` makes the host answer as it does for a binary that is not on the `PATH`. */
  installed: boolean;
  /** The instances the CLI holds a login for. Empty is a `glab` that is installed and logged in to nothing. */
  logins: { host: string; login: string }[];
};

export const isGlabSpec = (spec: ProcessSpec) => spec.command === 'glab';

/** The host's own wording for a missing binary. `isMissingCliError` reads exactly this prefix. */
export const glabNotInstalledMessage = () => 'not installed: glab';

const authReport = (state: FakeGlabState) =>
  state.logins.map((login) => `${login.host}\n  ✓ Logged in to ${login.host} as ${login.login} (keyring)\n`).join('') ||
  'gitlab.example.com\n  ! No token found (checked config file, keyring, and environment variables).\n';

const routedFrom = (endpoint: string): FakeRoutedRequest => {
  const url = new URL(endpoint.replace(/^\/?/, '/'), 'https://gitlab.example.com');

  return { method: 'GET', path: url.pathname, query: url.searchParams, body: undefined };
};

/**
 * Runs one `glab` call against the same fake GitLab the transport talks to.
 *
 * The failure shape is copied from the real binary, measured on 2026-09-10: the API's own JSON body
 * goes to stdout and the status reaches stderr only through a `(HTTP <code>)` suffix. A fake that
 * answered with a status field instead would let the parser that reads that line go untested.
 */
export const runFakeGlab = (options: {
  backend: FakeBackend;
  spec: ProcessSpec;
  state: FakeGlabState;
}): ProcessResult => {
  const { backend, spec, state } = options;
  const [verb] = spec.args;

  if (verb === 'auth') return { code: state.logins.length > 0 ? 0 : 1, stdout: '', stderr: authReport(state) };
  if (verb !== 'api') return { code: 1, stdout: '', stderr: `glab: unknown command ${String(verb)}` };

  const answer = respondGitLab(backend, routedFrom(spec.args.at(-1) ?? ''));
  const stdout = JSON.stringify(answer.body ?? {});

  return answer.status >= 200 && answer.status < 300
    ? { code: 0, stdout, stderr: '' }
    : { code: 1, stdout, stderr: `glab: refused (HTTP ${answer.status})` };
};
