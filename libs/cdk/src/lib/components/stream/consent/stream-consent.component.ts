import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { StreamConsentAcceptDirective } from './headless/stream-consent-accept.directive';
import { StreamConsentDirective } from './headless/stream-consent.directive';

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
    @property --et-stream-consent-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: #000000;
    }

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

    @property --et-stream-consent-placeholder-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 8px;
    }

    @property --et-stream-consent-placeholder-text-color {
      syntax: '<color>';
      inherits: false;
      initial-value: #ffffff;
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
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: var(--et-stream-consent-bg);

      .et-stream-consent-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--et-stream-consent-placeholder-gap);
        background: var(--et-stream-consent-placeholder-bg);
        padding: var(--et-stream-consent-placeholder-padding);

        .et-stream-consent-placeholder-text {
          color: var(--et-stream-consent-placeholder-text-color);
        }

        .et-stream-consent-accept-btn {
          background: var(--et-stream-consent-accept-bg);
          color: var(--et-stream-consent-accept-color);
        }
      }
    }
  `,
})
export class StreamConsentComponent {
  placeholderText = input('Please accept the terms to watch this content.');
  acceptLabel = input('Accept & Watch');
}
