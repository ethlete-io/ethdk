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

const FORMAT_PREFIX = '1.';
const CHECKSUM_LENGTH = 8;

const checksum = (text: string) => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(CHECKSUM_LENGTH, '0');
};

const isPrintable = (text: string) => /^[\x20-\x7e]+$/.test(text);

const revealChecked = (payload: string, key: string) => {
  const plain = xorCipher(atob(payload), key);
  const token = plain.slice(CHECKSUM_LENGTH);

  return token && plain.slice(0, CHECKSUM_LENGTH) === checksum(token) ? token : null;
};

const revealLegacy = (value: string, key: string) => {
  let obfuscated: string;

  try {
    obfuscated = atob(value);
  } catch {
    return value;
  }

  const token = xorCipher(obfuscated, key);

  return isPrintable(token) ? token : null;
};

// Not encryption: the key sits in this origin's localStorage, so any script on the page can reverse it.
export const obfuscateToken = (token: string) => {
  if (!token) return token;

  try {
    return `${FORMAT_PREFIX}${btoa(xorCipher(`${checksum(token)}${token}`, getKey()))}`;
  } catch {
    return '';
  }
};

export const deobfuscateToken = (obfuscatedToken: string) => {
  if (!obfuscatedToken) return obfuscatedToken;

  try {
    const key = getKey();

    return obfuscatedToken.startsWith(FORMAT_PREFIX)
      ? revealChecked(obfuscatedToken.slice(FORMAT_PREFIX.length), key)
      : revealLegacy(obfuscatedToken, key);
  } catch {
    return null;
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
