import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { StreamConsentAcceptDirective } from './stream-consent-accept.directive';
import { StreamConsentDirective } from './stream-consent.directive';

@Component({
  selector: 'et-stream-consent',
  template: `
    <div class="et-stream-consent-placeholder">
      <p class="et-stream-consent-placeholder-text">{{ placeholderText() }}</p>
      <button class="et-stream-consent-accept-btn" etStreamConsentAccept>
        {{ acceptLabel() }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [StreamConsentAcceptDirective],
  hostDirectives: [StreamConsentDirective],
  host: {
    class: 'et-stream-consent',
  },
  styles: `
    @property --et-stream-consent-placeholder-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: transparent;
    }

    @property --et-stream-consent-placeholder-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-stream-consent-accept-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: #000000;
    }

    @property --et-stream-consent-accept-color {
      syntax: '<color>';
      inherits: false;
      initial-value: #ffffff;
    }

    .et-stream-consent {
      display: block;
    }

    .et-stream-consent-placeholder {
      background: var(--et-stream-consent-placeholder-bg);
      padding: var(--et-stream-consent-placeholder-padding);
    }

    .et-stream-consent-accept-btn {
      background: var(--et-stream-consent-accept-bg);
      color: var(--et-stream-consent-accept-color);
    }
  `,
})
export class StreamConsentComponent {
  placeholderText = input('Please accept the terms to watch this content.');
  acceptLabel = input('Accept & Watch');
}
