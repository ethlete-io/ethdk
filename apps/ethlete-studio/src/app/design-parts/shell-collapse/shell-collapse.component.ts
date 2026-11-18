import { Component, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, TOOLTIP_IMPORTS } from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-shell-collapse',
  template: `
    <button
      [etTooltip]="LABELS.hidePanel"
      [attr.aria-label]="LABELS.hidePanel"
      (click)="collapse.emit()"
      class="size-control-sm p-0"
      et-button
      type="button"
      variant="transparent"
      color="surface"
      size="sm"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="2.5" y="3" width="11" height="10" rx="1.75" />
        <path d="M6.5 3v10" />
      </svg>
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, TOOLTIP_IMPORTS],
  host: { class: 'inline-flex' },
})
export class ShellCollapseComponent {
  public collapse = output();

  protected readonly LABELS = STUDIO_LABELS.shell;
}
