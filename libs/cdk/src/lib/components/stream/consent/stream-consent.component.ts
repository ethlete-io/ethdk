import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, contentChild, inject } from '@angular/core';
import { StreamConsentContentDirective } from './stream-consent-content.directive';
import { StreamConsentPlaceholderDirective } from './stream-consent-placeholder.directive';
import { STREAM_CONSENT_TOKEN, StreamConsentDirective } from './stream-consent.directive';

@Component({
  selector: 'et-stream-consent',
  template: `
    @if (consent.isGranted()) {
      <ng-container [ngTemplateOutlet]="contentSlot()?.templateRef ?? null" />
    } @else {
      <ng-container [ngTemplateOutlet]="placeholderSlot()?.templateRef ?? null" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: StreamConsentDirective }],
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-stream-consent',
  },
})
export class StreamConsentComponent {
  protected consent = inject(STREAM_CONSENT_TOKEN);
  protected contentSlot = contentChild(StreamConsentContentDirective);
  protected placeholderSlot = contentChild(StreamConsentPlaceholderDirective);
}
