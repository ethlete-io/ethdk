import { InjectionToken, Provider, Signal } from '@angular/core';

export interface ConsentHandler {
  /** Signal that is `true` when consent has been granted. */
  isGranted: Signal<boolean>;
  /** Grants consent and writes the decision back to the source. */
  grant: () => void;
  /** Revokes consent and writes the decision back to the source. */
  revoke?: () => void;
}

export type CreateUserConsentProviderOptions = {
  /** The provider result returned by `createStaticProvider` that this consent provider should be associated with. */
  for: InjectionToken<ConsentHandler | null>;

  /**
   * Factory executed inside the injection context that returns a `Signal<boolean>`.
   *
   * @example
   * isGranted: () => inject(CookieService).hasMediaConsent
   */
  isGranted: () => Signal<boolean>;

  /**
   * Factory executed inside the injection context that returns the grant function.
   *
   * @example
   * grant: () => () => inject(CookieService).acceptAll()
   */
  grant: () => () => void;

  /**
   * Factory executed inside the injection context that returns the revoke  function.
   *
   * @example
   * revoke : () => () => inject(CookieService).revokeAll()
   */
  revoke?: () => () => void;
};

export const createUserConsentProvider = (options: CreateUserConsentProviderOptions): Provider => ({
  provide: options.for,
  useFactory: (): ConsentHandler => ({
    isGranted: options.isGranted(),
    grant: options.grant(),
    ...(options.revoke ? { revoke: options.revoke() } : {}),
  }),
});
