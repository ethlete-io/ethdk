export const parseWebUrl = (href: string): URL | null => {
  if (!/^(?:https?:)?\/\//i.test(href)) {
    return null;
  }

  try {
    return new URL(href.startsWith('//') ? 'https:' + href : href);
  } catch {
    return null;
  }
};

const parseConfiguredHost = (host: string) => {
  const value = host.trim().toLowerCase();
  const wildcard = value.startsWith('*.');
  const bare = wildcard ? value.slice(2) : value;

  try {
    const url = new URL(bare.includes('://') ? bare : 'https://' + bare);

    return { hostname: url.hostname, port: url.port, wildcard };
  } catch {
    return { hostname: bare.split(':')[0] ?? bare, port: '', wildcard };
  }
};

const matchesConfiguredHost = (url: URL, configuredHost: string) => {
  const { hostname, port, wildcard } = parseConfiguredHost(configuredHost);

  if (!hostname || (port && url.port !== port)) return false;

  return wildcard ? url.hostname.endsWith('.' + hostname) : url.hostname === hostname;
};

export type WebUrlContext = { location: Location; internalHosts: string[] };

export const isInternalWebUrl = (url: URL, { location, internalHosts }: WebUrlContext) =>
  (url.hostname === location.hostname && url.port === location.port) ||
  internalHosts.some((host) => matchesConfiguredHost(url, host));

export const isExternalWebHref = (href: string, context: WebUrlContext) => {
  const url = parseWebUrl(href);

  return url !== null && !isInternalWebUrl(url, context);
};

export const internalWebHrefPath = (href: string, context: WebUrlContext) => {
  const url = parseWebUrl(href);

  return url && isInternalWebUrl(url, context) ? url.pathname + url.search + url.hash : null;
};

export const hasUrlScheme = (href: string) => /^[a-z][a-z\d+.-]*:/i.test(href);

export const isRouteRelativeHref = (href: string) => !hasUrlScheme(href) && !href.startsWith('/');

export const resolveHrefAgainstRoute = (href: string, routerUrl: string) => {
  const resolved = new URL(href, 'https://contentful.invalid' + routerUrl);

  return resolved.pathname + resolved.search + resolved.hash;
};
