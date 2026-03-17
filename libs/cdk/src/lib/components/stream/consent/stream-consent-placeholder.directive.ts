import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const STREAM_CONSENT_PLACEHOLDER_TOKEN = new InjectionToken<StreamConsentPlaceholderDirective>(
  'STREAM_CONSENT_PLACEHOLDER_TOKEN',
);

@Directive({
  selector: '[etStreamConsentPlaceholder]',
  providers: [{ provide: STREAM_CONSENT_PLACEHOLDER_TOKEN, useExisting: StreamConsentPlaceholderDirective }],
})
export class StreamConsentPlaceholderDirective {
  templateRef = inject(TemplateRef);
}
