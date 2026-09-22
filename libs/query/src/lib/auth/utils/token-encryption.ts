const ENCRYPTION_KEY_STORAGE = '__eth_ek';

const deviceInfo = () => {
  const navigatorInfo = typeof navigator !== 'undefined' ? `${navigator.userAgent}${navigator.language}` : 'server';
  const screenInfo =
    typeof screen !== 'undefined' ? `${screen.width}${screen.height}${screen.colorDepth}` : 'no-screen';

  return `${navigatorInfo}${screenInfo}`;
};

const generateEncryptionKey = () => btoa(`${deviceInfo()}${Math.random().toString(36).substring(2, 15)}`);

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
    const stored = storage.getItem(ENCRYPTION_KEY_STORAGE);

    if (stored) return stored;

    const newKey = generateEncryptionKey();
    storage.setItem(ENCRYPTION_KEY_STORAGE, newKey);

    return storage.getItem(ENCRYPTION_KEY_STORAGE) === newKey ? newKey : null;
  } catch {
    return null;
  }
};

// A key that cannot be persisted must not be random, or the next page load cannot decrypt the cookie.
const getEncryptionKey = () => {
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

export const encryptToken = (token: string) => {
  if (!token) return token;

  try {
    const key = getEncryptionKey();
    const encrypted = xorCipher(token, key);
    return btoa(encrypted);
  } catch {
    return '';
  }
};

export const decryptToken = (encryptedToken: string) => {
  if (!encryptedToken) return encryptedToken;

  try {
    const key = getEncryptionKey();
    const encrypted = atob(encryptedToken);
    return xorCipher(encrypted, key);
  } catch {
    return encryptedToken;
  }
};

export const isEncrypted = (value: string) => {
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

export const resetEncryptionKey = () => {
  cachedKey = null;

  try {
    readStorage()?.removeItem(ENCRYPTION_KEY_STORAGE);
  } catch {
    return;
  }
};
