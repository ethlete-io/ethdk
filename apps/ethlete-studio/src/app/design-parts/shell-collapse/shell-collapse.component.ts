import { Component, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'ethlete-shell-collapse',
  template: `
    <button
      (click)="collapse.emit()"
      class="size-control-sm p-0"
      et-button
      type="button"
      variant="transparent"
      color="surface"
      size="sm"
      title="Hide panel"
      aria-label="Hide panel"
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
  imports: [BUTTON_IMPORTS],
  host: { class: 'inline-flex bg-et-surface-bg p-space-2 font-ui text-et-surface' },
})
export class ShellCollapseComponent {
  public collapse = output();
}
