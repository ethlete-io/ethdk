import { Directive, inject } from '@angular/core';
import { STREAM_CONSENT_TOKEN } from './stream-consent.directive';

@Directive({
  selector: '[etStreamConsentAccept]',
  host: {
    '(click)': 'consent.grant()',
  },
})
export class StreamConsentAcceptDirective {
  protected consent = inject(STREAM_CONSENT_TOKEN);
}
