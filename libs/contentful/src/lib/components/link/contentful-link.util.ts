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

const normalizeHostname = (host: string) => {
  const value = host.trim().toLowerCase();

  try {
    return new URL(value.includes('://') ? value : 'https://' + value).hostname;
  } catch {
    return value.split(':')[0] ?? value;
  }
};

const matchesHostname = (hostname: string, configuredHost: string) => {
  const normalizedHost = normalizeHostname(configuredHost);

  return hostname === normalizedHost || hostname.endsWith('.' + normalizedHost);
};

export type WebUrlContext = { location: Location; internalHosts: string[] };

export const isInternalWebUrl = (url: URL, { location, internalHosts }: WebUrlContext) =>
  (url.hostname === location.hostname && url.port === location.port) ||
  internalHosts.some((host) => matchesHostname(url.hostname, host));

export const isExternalWebHref = (href: string, context: WebUrlContext) => {
  const url = parseWebUrl(href);

  return url !== null && !isInternalWebUrl(url, context);
};

export const hasUrlScheme = (href: string) => /^[a-z][a-z\d+.-]*:/i.test(href);

export const isRouteRelativeHref = (href: string) => !hasUrlScheme(href) && !href.startsWith('/');

export const resolveHrefAgainstRoute = (href: string, routerUrl: string) => {
  const resolved = new URL(href, 'https://contentful.invalid' + routerUrl);

  return resolved.pathname + resolved.search + resolved.hash;
};
