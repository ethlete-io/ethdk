import { Component, input, ViewEncapsulation } from '@angular/core';
import { OVERLAY_CONTENT_IMPORTS, OverlayMainDirective } from '@ethlete/components';
import { DialogCloseComponent } from '../../components/dialog-close.component';
import { StudioMarkComponent } from '../../components/studio-mark.component';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-about-dialog',
  template: `
    <div class="flex items-center justify-between gap-space-3" etOverlayHeader>
      <h2 class="m-0 text-[1.8rem] font-semibold" et-overlay-title>{{ LABELS.title }}</h2>
      <ethlete-dialog-close [label]="LABELS.close" />
    </div>
    <div et-overlay-body>
      <div class="flex items-center gap-space-3">
        <ethlete-studio-mark class="size-12 shrink-0" />
        <div class="flex min-w-0 flex-col gap-space-1">
          <span class="text-ui-md font-ui-strong text-et-surface">{{ LABELS.product }}</span>
          @if (version()) {
            <span class="text-ui-sm wrap-anywhere text-et-surface-muted">{{ LABELS.version(version()) }}</span>
          }
        </div>
      </div>
      <p class="mt-space-3 mb-0 text-ui-sm text-et-surface-muted">{{ LABELS.license }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OVERLAY_CONTENT_IMPORTS, StudioMarkComponent, DialogCloseComponent],
  hostDirectives: [OverlayMainDirective],
})
export class AboutDialogComponent {
  public version = input('');

  protected readonly LABELS = STUDIO_LABELS.aboutDialog;
}
