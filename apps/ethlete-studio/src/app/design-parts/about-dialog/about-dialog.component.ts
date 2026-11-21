import { Component, output, input, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  ICON_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  provideIcons,
  TIMES_ICON,
} from '@ethlete/components';
import { StudioMarkComponent } from '../../components/studio-mark.component';
import { ABOUT_DIALOG_LABELS } from '../../i18n/shell-labels';

@Component({
  selector: 'ethlete-about-dialog',
  template: `
    <div class="flex items-center justify-between gap-space-3" etOverlayHeader>
      <h2 class="m-0 text-[1.8rem] font-semibold" et-overlay-title>{{ LABELS.title }}</h2>
      <button
        [attr.aria-label]="LABELS.close"
        (click)="close.emit()"
        et-icon-button
        type="button"
        variant="transparent"
        size="sm"
      >
        <i etIcon="et-times"></i>
      </button>
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
  imports: [BUTTON_IMPORTS, ICON_IMPORTS, OVERLAY_CONTENT_IMPORTS, StudioMarkComponent],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [OverlayMainDirective],
})
export class AboutDialogComponent {
  public version = input('');

  // eslint-disable-next-line @angular-eslint/no-output-native -- the design declares emit:close
  public close = output();

  protected readonly LABELS = ABOUT_DIALOG_LABELS;
}
