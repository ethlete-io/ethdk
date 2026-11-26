import {
  hasUrlScheme,
  isExternalWebHref,
  isInternalWebUrl,
  isRouteRelativeHref,
  parseWebUrl,
  resolveHrefAgainstRoute,
  WebUrlContext,
} from './contentful-link.util';

const context = (internalHosts: string[] = [], host = 'app.test', port = ''): WebUrlContext => ({
  location: { hostname: host, port } as Location,
  internalHosts,
});

describe('parseWebUrl', () => {
  it('parses http, https and protocol-relative urls', () => {
    expect(parseWebUrl('http://a.test/x')?.href).toBe('http://a.test/x');
    expect(parseWebUrl('HTTPS://a.test')?.hostname).toBe('a.test');
    expect(parseWebUrl('//cdn.test/img.png')?.href).toBe('https://cdn.test/img.png');
  });

  it('returns null for non-web and malformed urls', () => {
    expect(parseWebUrl('')).toBeNull();
    expect(parseWebUrl('/relative')).toBeNull();
    expect(parseWebUrl('mailto:a@b.test')).toBeNull();
    expect(parseWebUrl('ftp://a.test')).toBeNull();
    expect(parseWebUrl('//')).toBeNull();
    expect(parseWebUrl('https://')).toBeNull();
  });
});

describe('isInternalWebUrl', () => {
  it('matches the current host only on the same port', () => {
    expect(isInternalWebUrl(new URL('https://app.test/x'), context())).toBe(true);
    expect(isInternalWebUrl(new URL('https://app.test:8080/x'), context())).toBe(false);
    expect(isInternalWebUrl(new URL('http://localhost:4200/x'), context([], 'localhost', '4200'))).toBe(true);
  });

  it('normalizes configured hosts with a scheme, port, case or whitespace', () => {
    const url = new URL('https://example.com/x');

    expect(isInternalWebUrl(url, context(['https://example.com']))).toBe(true);
    expect(isInternalWebUrl(url, context(['example.com:443']))).toBe(true);
    expect(isInternalWebUrl(url, context(['  EXAMPLE.com ']))).toBe(true);
  });

  it('matches a configured host exactly, so a subdomain needs its own entry', () => {
    expect(isInternalWebUrl(new URL('https://shop.example.com/cart'), context(['example.com']))).toBe(false);
    expect(isInternalWebUrl(new URL('https://shop.example.com/cart'), context(['shop.example.com']))).toBe(true);
  });

  it('matches every subdomain, but not the bare host, for a *. pattern', () => {
    expect(isInternalWebUrl(new URL('https://shop.example.com/cart'), context(['*.example.com']))).toBe(true);
    expect(isInternalWebUrl(new URL('https://a.b.example.com/'), context(['*.example.com']))).toBe(true);
    expect(isInternalWebUrl(new URL('https://example.com/'), context(['*.example.com']))).toBe(false);
    expect(isInternalWebUrl(new URL('https://notexample.com/'), context(['*.example.com']))).toBe(false);
  });

  it('requires the port when a configured host names one', () => {
    expect(isInternalWebUrl(new URL('http://cms.test:8080/x'), context(['cms.test:8080']))).toBe(true);
    expect(isInternalWebUrl(new URL('http://cms.test:9090/x'), context(['cms.test:8080']))).toBe(false);
  });

  it('ignores an empty internal host list and empty entries', () => {
    expect(isInternalWebUrl(new URL('https://other.test'), context([]))).toBe(false);
    expect(isInternalWebUrl(new URL('https://other.test'), context(['', '   ']))).toBe(false);
  });

  it('does not match a host that merely ends with the configured name', () => {
    expect(isInternalWebUrl(new URL('https://notexample.com'), context(['example.com']))).toBe(false);
  });
});

describe('isExternalWebHref', () => {
  it('treats only foreign web urls as external', () => {
    expect(isExternalWebHref('https://other.test', context())).toBe(true);
    expect(isExternalWebHref('https://app.test/x', context())).toBe(false);
    expect(isExternalWebHref('/x', context())).toBe(false);
    expect(isExternalWebHref('mailto:a@b.test', context())).toBe(false);
    expect(isExternalWebHref('', context())).toBe(false);
  });
});

describe('route-relative hrefs', () => {
  it('detects schemes', () => {
    expect(hasUrlScheme('tel:+49')).toBe(true);
    expect(hasUrlScheme('web+app:x')).toBe(true);
    expect(hasUrlScheme('page:1')).toBe(true);
    expect(hasUrlScheme('1page:x')).toBe(false);
    expect(hasUrlScheme('')).toBe(false);
  });

  it('classifies relative hrefs', () => {
    expect(isRouteRelativeHref('child')).toBe(true);
    expect(isRouteRelativeHref('../sibling')).toBe(true);
    expect(isRouteRelativeHref('#top')).toBe(true);
    expect(isRouteRelativeHref('')).toBe(true);
    expect(isRouteRelativeHref('/abs')).toBe(false);
    expect(isRouteRelativeHref('//cdn.test')).toBe(false);
    expect(isRouteRelativeHref('mailto:a@b.test')).toBe(false);
  });

  it('resolves against the router url', () => {
    expect(resolveHrefAgainstRoute('child', '/a/b')).toBe('/a/child');
    expect(resolveHrefAgainstRoute('../x', '/a/b/c')).toBe('/a/x');
    expect(resolveHrefAgainstRoute('#top', '/a?q=1')).toBe('/a?q=1#top');
    expect(resolveHrefAgainstRoute('?page=2', '/a#old')).toBe('/a?page=2');
    expect(resolveHrefAgainstRoute('child', '')).toBe('/child');
    expect(resolveHrefAgainstRoute('../../../x', '/a')).toBe('/x');
  });
});
