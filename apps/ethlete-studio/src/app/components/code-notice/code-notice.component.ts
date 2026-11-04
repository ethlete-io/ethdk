import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { injectCodeWatch } from '../../code-watch';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-code-notice',
  template: `
    @if (codeWatch.notice(); as notice) {
      <div class="flex items-center gap-2" data-code-notice>
        <span class="text-et-surface-muted">{{ notice.text }}</span>
        @if (notice.action; as action) {
          <button (click)="codeWatch.act(action)" et-button type="button" variant="tonal" color="brand" size="xs">
            {{ LABELS.restart }}
          </button>
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  host: { class: 'contents' },
})
export class CodeNoticeComponent {
  protected codeWatch = injectCodeWatch();
  protected readonly LABELS = STUDIO_LABELS.code;
}
