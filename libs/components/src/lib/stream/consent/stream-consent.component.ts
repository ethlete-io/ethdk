import { Component, ViewEncapsulation, computed } from '@angular/core';
import { injectStreamLabels } from '../stream-labels';
import { mountStreamOverlayCardStyles } from '../stream-overlay-card-styles.component';
import { ButtonComponent } from '../../button';
import { IconDirective, LOCK_ICON, provideIcons } from '../../icon';
import { StreamConsentAcceptDirective } from './headless/stream-consent-accept.directive';
import { StreamConsentDirective } from './headless/stream-consent.directive';
import { injectStreamConsentConfig } from './stream-consent-config';

let nextHeadingId = 0;

@Component({
  selector: 'et-stream-consent',
  template: `
    <div class="et-stream-consent-card">
      <span class="et-stream-consent-icon" etIcon="et-lock"></span>
      <p [id]="HEADING_ID" class="et-stream-consent-heading">{{ heading() }}</p>
      <p class="et-stream-consent-description">{{ description() }}</p>
      <button [color]="acceptButtonColor()" et-button etStreamConsentAccept>
        {{ acceptLabel() }}
      </button>
    </div>
  `,
  styleUrl: './stream-consent.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [StreamConsentAcceptDirective, ButtonComponent, IconDirective],
  providers: [provideIcons(LOCK_ICON)],
  hostDirectives: [StreamConsentDirective],
  host: {
    class: 'et-stream-consent',
    role: 'group',
    '[attr.aria-labelledby]': 'HEADING_ID',
  },
})
export class StreamConsentComponent {
  private config = injectStreamConsentConfig();
  private labels = injectStreamLabels();
  protected readonly HEADING_ID = `et-stream-consent-heading-${nextHeadingId++}`;

  public heading = computed(() => this.labels().consentHeading);
  public description = computed(() => this.labels().consentDescription);
  public acceptLabel = computed(() => this.labels().consentAccept);
  public acceptButtonColor = computed(() => this.config.acceptButtonColor);

  constructor() {
    mountStreamOverlayCardStyles();
  }
}
