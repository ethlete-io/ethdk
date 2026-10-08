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
