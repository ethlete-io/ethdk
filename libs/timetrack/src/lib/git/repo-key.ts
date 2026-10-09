import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { TimetrackProcessRunner } from '../transport/ports';
import { preferredRemote } from './state';

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const USER_INFO = /^[^@/]*@/;
const PORT_BEFORE_PATH = /^([^/]+?)(?::\d+)?(\/.*)$/;
const SCP_HOST_PATH = /^([^/:]+):(.*)$/;
const HOST_PATH = /^([^/]+)(\/.*)?$/;

const splitRemote = (url: string) => {
  const hasScheme = SCHEME.test(url);
  const rest = url.replace(SCHEME, '').replace(USER_INFO, '');

  if (hasScheme) {
    const match = rest.match(PORT_BEFORE_PATH);

    return match ? { host: match[1], path: match[2] ?? '' } : { host: rest, path: '' };
  }

  const scp = rest.match(SCP_HOST_PATH);
  if (scp) return { host: scp[1], path: scp[2] ?? '' };

  const match = rest.match(HOST_PATH);
  return { host: match?.[1] ?? rest, path: match?.[2] ?? '' };
};

const normalizeRemote = (url: string) => {
  const { host, path } = splitRemote(url.trim());
  const cleanPath = path
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
    .replace(/^\/+/, '');

  return `${host}/${cleanPath}`.replace(/\/$/, '').toLowerCase();
};

const directoryName = (checkoutPath: string) => {
  const segments = checkoutPath.split(/[\\/]+/).filter(Boolean);
  return (segments[segments.length - 1] ?? '').toLowerCase();
};

/**
 * The stream key of a checkout: its normalized origin URL (host and path, lower-case, without scheme,
 * user, port, `.git` or trailing slash), or its lower-case directory name when there is no origin.
 */
export const repoKeyOf = (remoteUrl: string | null, checkoutPath: string): string =>
  remoteUrl?.trim() ? normalizeRemote(remoteUrl) : directoryName(checkoutPath);

/** The key of the checkout at `repoPath`, read through its preferred remote. A failed read keys it by its directory name. */
export const readRepoKey$ = (options: { processes: TimetrackProcessRunner; repoPath: string }): Observable<string> => {
  const { processes, repoPath } = options;
  const run$ = (args: string[]) => processes.run$({ command: 'git', args, cwd: repoPath });

  return run$(['remote']).pipe(
    switchMap((remotes) => {
      const name =
        remotes.code === 0
          ? preferredRemote(
              remotes.stdout
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            )
          : undefined;

      return name
        ? run$(['remote', 'get-url', name]).pipe(map((url) => (url.code === 0 ? url.stdout : null)))
        : of(null);
    }),
    catchError(() => of(null)),
    map((url) => repoKeyOf(url, repoPath)),
  );
};

const lowerPath = (path: string) => path.replace(/[\\/]+$/, '').toLowerCase();

/**
 * Re-keys every checkout whose origin is the local path of another known checkout to that checkout's
 * key, so a clone of a repository on this machine counts as the repository itself.
 */
export const resolveLocalOrigins = (keys: Record<string, string>): Record<string, string> => {
  const byPath = new Map(Object.entries(keys).map(([path, key]) => [lowerPath(path), key]));
  const resolve = (key: string, hops: number): string => {
    const next = key.startsWith('/') ? byPath.get(lowerPath(key)) : undefined;
    return next && next !== key && hops > 0 ? resolve(next, hops - 1) : key;
  };

  return Object.fromEntries(Object.entries(keys).map(([path, key]) => [path, resolve(key, 5)]));
};
