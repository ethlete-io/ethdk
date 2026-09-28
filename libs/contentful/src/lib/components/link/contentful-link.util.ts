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
