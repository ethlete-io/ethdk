const ENCRYPTION_KEY_STORAGE = '__eth_ek';

const generateEncryptionKey = () => {
  const navigatorInfo = typeof navigator !== 'undefined' ? `${navigator.userAgent}${navigator.language}` : 'server';
  const screenInfo =
    typeof screen !== 'undefined' ? `${screen.width}${screen.height}${screen.colorDepth}` : 'no-screen';

  const random = Math.random().toString(36).substring(2, 15);

  return btoa(`${navigatorInfo}${screenInfo}${random}`);
};

let cachedKey: string | null = null;

const getEncryptionKey = () => {
  if (cachedKey) return cachedKey;

  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
      if (stored) {
        cachedKey = stored;

        return stored;
      }
    } catch {
      cachedKey = null;
    }
  }

  const newKey = generateEncryptionKey();
  cachedKey = newKey;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ENCRYPTION_KEY_STORAGE, newKey);
    } catch {
      return newKey;
    }
  }

  return newKey;
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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ENCRYPTION_KEY_STORAGE);
  }
};
