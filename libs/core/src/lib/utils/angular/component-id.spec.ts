import { randomId } from './component-id';

describe('randomId', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    }
  });

  it('uses crypto.randomUUID when available', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'uuid-from-crypto' },
    });

    expect(randomId()).toBe('uuid-from-crypto');
  });

  it('falls back to getRandomValues in insecure contexts (crypto.randomUUID undefined)', () => {
    // Reproduces the plain-HTTP-over-IP case where crypto.randomUUID is undefined but
    // getRandomValues still works — previously any caller (overlay/menu open) threw here.
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: undefined,
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = i;

          return arr;
        },
      },
    });

    const id = randomId();

    expect(typeof id).toBe('string');
    // RFC-4122-ish shape: 8-4-4-4-12 hex, with version/variant bits set
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('falls back to a session id when Web Crypto is entirely absent', () => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

    expect(randomId()).toMatch(/^et-id-/);
  });
});
