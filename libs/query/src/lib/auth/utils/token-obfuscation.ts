const KEY_STORAGE = '__eth_ek';

const deviceInfo = () => {
  const navigatorInfo = typeof navigator !== 'undefined' ? `${navigator.userAgent}${navigator.language}` : 'server';
  const screenInfo =
    typeof screen !== 'undefined' ? `${screen.width}${screen.height}${screen.colorDepth}` : 'no-screen';

  return `${navigatorInfo}${screenInfo}`;
};

const generateKey = () => btoa(`${deviceInfo()}${Math.random().toString(36).substring(2, 15)}`);

const readStorage = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

let cachedKey: string | null = null;

const loadOrPersistKey = () => {
  const storage = readStorage();

  if (!storage) return null;

  try {
    const stored = storage.getItem(KEY_STORAGE);

    if (stored) return stored;

    const newKey = generateKey();
    storage.setItem(KEY_STORAGE, newKey);

    return storage.getItem(KEY_STORAGE) === newKey ? newKey : null;
  } catch {
    return null;
  }
};

// A key that cannot be persisted must not be random, or the next page load cannot read the cookie back.
const getKey = () => {
  cachedKey ??= loadOrPersistKey() ?? btoa(deviceInfo());

  return cachedKey;
};

const xorCipher = (text: string, key: string) => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};

// Not encryption: the key sits in this origin's localStorage, so any script on the page can reverse it.
export const obfuscateToken = (token: string) => {
  if (!token) return token;

  try {
    const key = getKey();
    const obfuscated = xorCipher(token, key);
    return btoa(obfuscated);
  } catch {
    return '';
  }
};

export const deobfuscateToken = (obfuscatedToken: string) => {
  if (!obfuscatedToken) return obfuscatedToken;

  try {
    const key = getKey();
    const obfuscated = atob(obfuscatedToken);
    return xorCipher(obfuscated, key);
  } catch {
    return obfuscatedToken;
  }
};

export const isObfuscated = (value: string) => {
  if (!value) return false;

  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(value)) return false;

  try {
    atob(value);
    return value.length > 20;
  } catch {
    return false;
  }
};

export const resetObfuscationKey = () => {
  cachedKey = null;

  try {
    readStorage()?.removeItem(KEY_STORAGE);
  } catch {
    return;
  }
};
