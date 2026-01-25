import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptToken, encryptToken, isEncrypted, resetEncryptionKey } from './token-encryption';

describe('token-encryption', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    _storage: Map<string, string>;
  };

  beforeEach(() => {
    // Mock localStorage with actual storage behavior
    const storage = new Map<string, string>();
    localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      _storage: storage,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    // Reset encryption key before each test for isolation
    resetEncryptionKey();
  });

  describe('encryptToken', () => {
    it('should encrypt a token', () => {
      const token = 'my-secret-token-123';
      const encrypted = encryptToken(token);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(token);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should return empty string for empty input', () => {
      expect(encryptToken('')).toBe('');
    });

    it('should produce base64-encoded output', () => {
      const token = 'test-token';
      const encrypted = encryptToken(token);

      // Base64 pattern
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should use stored key from localStorage', () => {
      const token = 'test-token';
      const encrypted1 = encryptToken(token);

      // Key should be stored in localStorage
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedKey = localStorageMock._storage.get('__eth_ek');
      expect(storedKey).toBeDefined();

      // Reset cache but not storage
      resetEncryptionKey();

      // Should load from storage and produce same output
      const encrypted2 = encryptToken(token);
      expect(encrypted2).toBe(encrypted1);
    });
  });

  describe('decryptToken', () => {
    it('should decrypt an encrypted token', () => {
      const originalToken = 'my-secret-token-123';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should return empty string for empty input', () => {
      expect(decryptToken('')).toBe('');
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(500);
      const encrypted = encryptToken(longToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(longToken);
    });

    it('should handle tokens with special characters', () => {
      const token = 'token-with-special-chars!@#$%^&*()';
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });

    it('should handle JWT-like tokens', () => {
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const encrypted = encryptToken(jwtToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(jwtToken);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted tokens', () => {
      const token = 'my-secret-token-123';
      const encrypted = encryptToken(token);

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for unencrypted tokens', () => {
      expect(isEncrypted('plain-token')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for short base64-like strings', () => {
      expect(isEncrypted('abc=')).toBe(false);
    });
  });

  describe('encryption/decryption round-trip', () => {
    it('should maintain token integrity through multiple operations', () => {
      const token = 'original-token';

      const encrypted1 = encryptToken(token);
      const decrypted1 = decryptToken(encrypted1);
      const encrypted2 = encryptToken(decrypted1);
      const decrypted2 = decryptToken(encrypted2);

      expect(decrypted1).toBe(token);
      expect(decrypted2).toBe(token);
    });

    it('should handle encryption of already encrypted tokens', () => {
      const token = 'original-token';
      const encrypted = encryptToken(token);
      const doubleEncrypted = encryptToken(encrypted);
      const decryptedOnce = decryptToken(doubleEncrypted);
      const decryptedTwice = decryptToken(decryptedOnce);

      expect(decryptedTwice).toBe(token);
    });
  });

  describe('encryption key behavior', () => {
    it('should use the same key within a session', () => {
      const token = 'test-token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // Same encryption key = same encrypted output
      expect(encrypted1).toBe(encrypted2);
    });
  });
});
