import { Directive, InjectionToken, computed, inject, signal } from '@angular/core';
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
  private handler = injectStreamUserConsentProvider();
  private localGranted = signal(false);

  isGranted = this.handler ? computed(() => (this.handler as ConsentHandler).isGranted()) : this.localGranted;

  grant(): void {
    if (this.handler) {
      this.handler.grant();
    } else {
      this.localGranted.set(true);
    }
  }

  revoke(): void {
    if (this.handler) {
      this.handler.revoke?.();
    } else {
      this.localGranted.set(false);
    }
  }
}
