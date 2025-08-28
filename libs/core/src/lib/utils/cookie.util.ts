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

  // From https://stackoverflow.com/questions/10730362/get-cookie-by-name
  return ('; ' + document.cookie).split(`; ${name}=`).pop()?.split(';')[0];
};

export const setCookie = (
  name: string,
  data: string,
  expiresInDays = 30,
  domain = getDomain(),
  path = '/',
  sameSite: 'strict' | 'none' | 'lax' = 'lax',
) => {
  if (typeof document === 'undefined') {
    return;
  }

  const sameSiteUpper = sameSite.toUpperCase();
  const date = new Date();
  date.setTime(date.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

  document.cookie = `${name}=${data}; path=${path}; expires=${date.toUTCString()}; domain=${domain}; SameSite=${sameSiteUpper};`;
};

export const deleteCookie = (name: string, path = '/', domain = getDomain()) => {
  if (hasCookie(name)) {
    document.cookie =
      name +
      '=' +
      (path ? ';path=' + path : '') +
      (domain ? ';domain=' + domain : '') +
      ';expires=Thu, 01 Jan 1970 00:00:01 GMT';
  }
};

export const getDomain = () => {
  if (typeof navigator === 'undefined') {
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
