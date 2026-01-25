const ENCRYPTION_KEY_STORAGE = '__eth_ek';

const generateEncryptionKey = (): string => {
  const navigatorInfo =
    typeof navigator !== 'undefined'
      ? `${navigator.userAgent}${navigator.language}${screen.width}${screen.height}${screen.colorDepth}`
      : 'server';

  const random = Math.random().toString(36).substring(2, 15);

  return btoa(`${navigatorInfo}${random}`);
};

let cachedKey: string | null = null;

const getEncryptionKey = (): string => {
  if (cachedKey) return cachedKey;

  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
    if (stored) {
      cachedKey = stored;
      return stored;
    }

    const newKey = generateEncryptionKey();
    localStorage.setItem(ENCRYPTION_KEY_STORAGE, newKey);
    cachedKey = newKey;
    return newKey;
  }

  if (!cachedKey) {
    cachedKey = generateEncryptionKey();
  }
  return cachedKey;
};

const xorCipher = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};

export const encryptToken = (token: string): string => {
  if (!token) return token;

  try {
    const key = getEncryptionKey();
    const encrypted = xorCipher(token, key);
    return btoa(encrypted);
  } catch {
    return token;
  }
};

export const decryptToken = (encryptedToken: string): string => {
  if (!encryptedToken) return encryptedToken;

  try {
    const key = getEncryptionKey();
    const encrypted = atob(encryptedToken);
    return xorCipher(encrypted, key);
  } catch {
    return encryptedToken;
  }
};

export const isEncrypted = (value: string): boolean => {
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

export const resetEncryptionKey = (): void => {
  cachedKey = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ENCRYPTION_KEY_STORAGE);
  }
};
