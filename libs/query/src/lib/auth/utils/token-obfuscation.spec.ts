import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deobfuscateToken, obfuscateToken, isObfuscated, resetObfuscationKey } from './token-obfuscation';

describe('token-obfuscation', () => {
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

    // Reset the obfuscation key before each test for isolation
    resetObfuscationKey();
  });

  describe('obfuscateToken', () => {
    it('should obfuscate a token', () => {
      const token = 'my-secret-token-123';
      const obfuscated = obfuscateToken(token);

      expect(obfuscated).toBeDefined();
      expect(obfuscated).not.toBe(token);
      expect(obfuscated.length).toBeGreaterThan(0);
    });

    it('should return empty string for empty input', () => {
      expect(obfuscateToken('')).toBe('');
    });

    it('should produce base64-encoded output', () => {
      const token = 'test-token';
      const obfuscated = obfuscateToken(token);

      // Base64 pattern
      expect(obfuscated).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should use stored key from localStorage', () => {
      const token = 'test-token';
      const obfuscated1 = obfuscateToken(token);

      // Key should be stored in localStorage
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedKey = localStorageMock._storage.get('__eth_ek');
      expect(storedKey).toBeDefined();

      // Reset cache but not storage
      resetObfuscationKey();

      // Should load from storage and produce same output
      const obfuscated2 = obfuscateToken(token);
      expect(obfuscated2).toBe(obfuscated1);
    });

    it('should keep the token obfuscated when browser storage is unavailable', () => {
      resetObfuscationKey();
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('blocked');
      });
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('blocked');
      });

      const obfuscated = obfuscateToken('test-token');

      expect(obfuscated).not.toBe('test-token');
      expect(deobfuscateToken(obfuscated)).toBe('test-token');
    });
  });

  describe('deobfuscateToken', () => {
    it('should reveal an obfuscated token', () => {
      const originalToken = 'my-secret-token-123';
      const obfuscated = obfuscateToken(originalToken);
      const revealed = deobfuscateToken(obfuscated);

      expect(revealed).toBe(originalToken);
    });

    it('should return empty string for empty input', () => {
      expect(deobfuscateToken('')).toBe('');
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(500);
      const obfuscated = obfuscateToken(longToken);
      const revealed = deobfuscateToken(obfuscated);

      expect(revealed).toBe(longToken);
    });

    it('should handle tokens with special characters', () => {
      const token = 'token-with-special-chars!@#$%^&*()';
      const obfuscated = obfuscateToken(token);
      const revealed = deobfuscateToken(obfuscated);

      expect(revealed).toBe(token);
    });

    it('should handle JWT-like tokens', () => {
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const obfuscated = obfuscateToken(jwtToken);
      const revealed = deobfuscateToken(obfuscated);

      expect(revealed).toBe(jwtToken);
    });
  });

  describe('isObfuscated', () => {
    it('should return true for obfuscated tokens', () => {
      const token = 'my-secret-token-123';
      const obfuscated = obfuscateToken(token);

      expect(isObfuscated(obfuscated)).toBe(true);
    });

    it('should return false for unobfuscated tokens', () => {
      expect(isObfuscated('plain-token')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isObfuscated('')).toBe(false);
    });

    it('should return false for short base64-like strings', () => {
      expect(isObfuscated('abc=')).toBe(false);
    });
  });

  describe('obfuscation round-trip', () => {
    it('should maintain token integrity through multiple operations', () => {
      const token = 'original-token';

      const obfuscated1 = obfuscateToken(token);
      const revealed1 = deobfuscateToken(obfuscated1);
      const obfuscated2 = obfuscateToken(revealed1);
      const revealed2 = deobfuscateToken(obfuscated2);

      expect(revealed1).toBe(token);
      expect(revealed2).toBe(token);
    });

    it('should handle obfuscation of already obfuscated tokens', () => {
      const token = 'original-token';
      const obfuscated = obfuscateToken(token);
      const doubleObfuscated = obfuscateToken(obfuscated);
      const revealedOnce = deobfuscateToken(doubleObfuscated);
      const revealedTwice = deobfuscateToken(revealedOnce);

      expect(revealedTwice).toBe(token);
    });
  });

  describe('obfuscation key behavior', () => {
    it('should use the same key within a session', () => {
      const token = 'test-token';
      const obfuscated1 = obfuscateToken(token);
      const obfuscated2 = obfuscateToken(token);

      // Same key = same output
      expect(obfuscated1).toBe(obfuscated2);
    });
  });
});
