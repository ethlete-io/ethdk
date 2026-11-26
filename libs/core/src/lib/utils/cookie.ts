// Only what a cookie value cannot hold is escaped, so base64 and JWT values stay byte-identical for
// servers and older readers that do not decode them.
const encodeCookieValue = (value: string) =>
  encodeURIComponent(value).replace(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent);

export const hasCookie = (name: string) => {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.cookie.split(';').some((c) => {
    return c.trim().startsWith(name + '=');
  });
};

export const getCookie = (name: string) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie.split(';').find((entry) => entry.trim().startsWith(`${name}=`));

  const raw = cookie?.trim().slice(name.length + 1);

  if (raw === undefined) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const setCookie = (
  name: string,
  data: string,
  expiresInDays?: number | null,
  domain?: string | null,
  path = '/',
  sameSite: 'strict' | 'none' | 'lax' = 'lax',
) => {
  if (typeof document === 'undefined') {
    return;
  }

  const derivedDomain = domain === undefined;
  const resolvedDomain = derivedDomain ? getDomain() : domain;
  const sameSiteUpper = sameSite.toUpperCase();

  const expires = expiresInDays ?? 30;

  let cookieString = `${name}=${encodeCookieValue(data)}; path=${path}`;

  if (expiresInDays !== null) {
    const date = new Date();
    date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
    cookieString += `; expires=${date.toUTCString()}`;
  }

  const attributes = (withDomain: boolean) => {
    let result = cookieString;

    if (withDomain && resolvedDomain) {
      result += `; domain=${resolvedDomain}`;
    }

    return result;
  };

  let suffix = `; SameSite=${sameSiteUpper}`;

  if (sameSite === 'none' || (typeof window !== 'undefined' && window.location.protocol === 'https:')) {
    suffix += '; Secure';
  }

  suffix += ';';
  document.cookie = attributes(true) + suffix;

  if (derivedDomain && resolvedDomain && getCookie(name) !== data) {
    document.cookie = attributes(false) + suffix;
  }
};

export const deleteCookie = (name: string, path = '/', domain?: string | null) => {
  if (!hasCookie(name)) return;

  const derivedDomain = domain === undefined;
  const resolvedDomain = derivedDomain ? getDomain() : domain;
  const expire = (withDomain: boolean) => {
    document.cookie =
      name +
      '=' +
      (path ? ';path=' + path : '') +
      (withDomain && resolvedDomain ? ';domain=' + resolvedDomain : '') +
      ';expires=Thu, 01 Jan 1970 00:00:01 GMT';
  };

  expire(true);

  if (derivedDomain && hasCookie(name)) {
    expire(false);
  }
};

export const getDomain = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const hostname = window.location.hostname;

  if (hostname.includes('localhost')) {
    return 'localhost';
  }

  const hostIsIP = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);

  if (hostIsIP) {
    return hostname;
  }

  const splitHost = hostname.split('.');

  if (splitHost.length > 2) {
    return `${splitHost[splitHost.length - 2]}.${splitHost[splitHost.length - 1]}`;
  }

  return hostname;
};
