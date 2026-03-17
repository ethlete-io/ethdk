import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const STREAM_CONSENT_CONTENT_TOKEN = new InjectionToken<StreamConsentContentDirective>(
  'STREAM_CONSENT_CONTENT_TOKEN',
);

@Directive({
  selector: '[etStreamConsentContent]',
  providers: [{ provide: STREAM_CONSENT_CONTENT_TOKEN, useExisting: StreamConsentContentDirective }],
})
export class StreamConsentContentDirective {
  templateRef = inject(TemplateRef);
}
