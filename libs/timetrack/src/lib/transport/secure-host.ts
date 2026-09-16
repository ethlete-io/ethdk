/**
 * The hosts plain `http` is allowed on. A request to one of them never leaves the machine, which is
 * what the OAuth redirect listener and a developer's own instance both rely on.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);

/**
 * Whether a URL may carry a credential: `https` anywhere, plain `http` on loopback alone.
 *
 * The rule is the host transport's rule (`is_private_enough` in `http.rs`). A provider client has to
 * apply it before it builds the authorization header, so that a host typed with `http://` is refused
 * by name instead of reported as a transport rejection after the token is already in the request.
 */
export const carriesCredentialsSafely = (url: string) => {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'https:') return true;

  return parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname);
};

/** The one message every provider gives for a host that would put its token on the wire in the clear. */
export const insecureHostMessage = (options: { provider: string; url: string }) =>
  `${options.url} is not https, so the ${options.provider} token would go over the wire in the clear. Change the host in Settings.`;
