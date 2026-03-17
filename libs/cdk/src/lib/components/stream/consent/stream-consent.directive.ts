import { Directive, InjectionToken, Signal, computed, inject, signal } from '@angular/core';
import { ConsentHandler } from '@ethlete/core';

export const STREAM_CONSENT_TOKEN = new InjectionToken<StreamConsentDirective>('STREAM_CONSENT_TOKEN');

export const STREAM_USER_CONSENT_PROVIDER_TOKEN = new InjectionToken<ConsentHandler | null>(
  'STREAM_USER_CONSENT_PROVIDER_TOKEN',
);

export const injectStreamUserConsentProvider = () => inject(STREAM_USER_CONSENT_PROVIDER_TOKEN, { optional: true });

@Directive({
  providers: [{ provide: STREAM_CONSENT_TOKEN, useExisting: StreamConsentDirective }],
})
export class StreamConsentDirective {
  private readonly _handler = injectStreamUserConsentProvider();
  private readonly _localGranted = signal(false);

  readonly isGranted: Signal<boolean> = this._handler
    ? computed(() => (this._handler as ConsentHandler).isGranted())
    : this._localGranted;

  grant(): void {
    if (this._handler) {
      this._handler.grant();
    } else {
      this._localGranted.set(true);
    }
  }

  revoke(): void {
    if (this._handler) {
      this._handler.revoke?.();
    } else {
      this._localGranted.set(false);
    }
  }
}
