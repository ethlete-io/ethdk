import { ProcessResult, ProcessSpec, TimetrackRequestMethod } from '@ethlete/timetrack';
import { FakeForgeCliState, forgeAuthReport, forgeEndpointOf } from './forge-cli';
import { respondGitLab } from './gitlab';
import { FakeRoutedRequest } from './route';
import { FakeBackend } from './types';

export type FakeGlabState = FakeForgeCliState;

export const isGlabSpec = (spec: ProcessSpec) => spec.command === 'glab';

const methodOf = (spec: ProcessSpec): TimetrackRequestMethod => {
  const at = spec.args.indexOf('--method');

  return at < 0 ? 'GET' : ((spec.args[at + 1] ?? 'GET') as TimetrackRequestMethod);
};

/** A write sends its JSON body on stdin through `--input -`, exactly as the real call does. */
const routedFrom = (spec: ProcessSpec): FakeRoutedRequest => {
  const url = new URL(forgeEndpointOf(spec).replace(/^\/?/, '/'), 'https://gitlab.example.com');
  const readsStdin = spec.args[spec.args.indexOf('--input') + 1] === '-';

  return {
    method: methodOf(spec),
    path: url.pathname,
    query: url.searchParams,
    body: readsStdin && spec.stdin ? (JSON.parse(spec.stdin) as unknown) : undefined,
  };
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

  if (verb === 'auth') {
    return {
      code: state.logins.length > 0 ? 0 : 1,
      stdout: '',
      stderr: forgeAuthReport({ cli: 'glab', state, emptyHost: 'gitlab.example.com' }),
    };
  }

  if (verb !== 'api') return { code: 1, stdout: '', stderr: `glab: unknown command ${String(verb)}` };

  const answer = respondGitLab(backend, routedFrom(spec));
  const stdout = JSON.stringify(answer.body ?? {});

  return answer.status >= 200 && answer.status < 300
    ? { code: 0, stdout, stderr: '' }
    : { code: 1, stdout, stderr: `glab: refused (HTTP ${answer.status})` };
};
