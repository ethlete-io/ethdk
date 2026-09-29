import { inject, InjectionToken, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConsentHandler, createUserConsentProvider } from './user-consent';

describe('createUserConsentProvider', () => {
  const TOKEN = new InjectionToken<ConsentHandler | null>('TEST_CONSENT');
  const STORE = new InjectionToken('TEST_CONSENT_STORE', { factory: () => signal(false) });

  it('runs the factories in the injection context and wires grant and revoke', () => {
    TestBed.configureTestingModule({
      providers: [
        createUserConsentProvider({
          for: TOKEN,
          isGranted: () => inject(STORE),
          grant: () => {
            const store = inject(STORE);
            return () => store.set(true);
          },
          revoke: () => {
            const store = inject(STORE);
            return () => store.set(false);
          },
        }),
      ],
    });

    const handler = TestBed.inject(TOKEN);

    expect(handler?.isGranted()).toBe(false);
    handler?.grant();
    expect(handler?.isGranted()).toBe(true);
    handler?.revoke?.();
    expect(handler?.isGranted()).toBe(false);
  });

  it('omits revoke when no factory is given', () => {
    TestBed.configureTestingModule({
      providers: [createUserConsentProvider({ for: TOKEN, isGranted: () => signal(true), grant: () => () => null })],
    });

    expect(TestBed.inject(TOKEN)?.revoke).toBeUndefined();
  });
});
