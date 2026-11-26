import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { BUTTON_IMPORTS, TOGGLETIP_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';

export type SketchBadgeStatus =
  | 'drawing'
  | 'waiting'
  | 'paused'
  | 'failed'
  | 'merging'
  | 'autoMerge'
  | 'awaitingApproval'
  | 'awaitingSubParts'
  | 'approved';

const ICON: Record<SketchBadgeStatus, string> = {
  drawing: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  waiting:
    '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  awaitingApproval: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  awaitingSubParts: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  approved: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  paused: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  failed:
    '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  merging:
    '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M6 9a9 9 0 0 0 9 9"/>',
  autoMerge: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
};

const TONE: Record<SketchBadgeStatus, string> = {
  drawing: 'text-(--et-theme-color-primary-solid) animate-pulse',
  waiting: 'text-(--et-theme-color-primary-solid)',
  awaitingApproval: 'text-(--et-theme-color-primary-solid)',
  awaitingSubParts: 'text-et-surface-muted',
  approved: 'text-et-surface',
  paused: 'text-et-surface-muted',
  failed: 'text-(--et-theme-color-primary-solid)',
  merging: 'text-(--et-theme-color-primary-solid) animate-pulse',
  autoMerge: 'text-(--et-theme-color-primary-solid)',
};

@Component({
  selector: 'ethlete-sketch-status-badge',
  template: `
    <span [etProvideColor]="scope()" [attr.data-sk-status]="status()" class="flex flex-none">
      <button
        [etToggletipOpen]="open()"
        [etToggletip]="tip"
        [etToggletipAriaLabel]="tipText().label"
        [attr.aria-label]="tipText().label"
        et-icon-button
        etToggletipTrigger
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        data-sk-status-button
      >
        <svg
          [class]="tone()"
          [innerHTML]="icon()"
          class="size-4"
          etIcon
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          data-sk-status-icon
        ></svg>
      </button>
    </span>
    <ng-template #tip>
      <div class="flex max-w-64 flex-col gap-space-1 text-ui-sm" data-toggletip-body data-sk-status-tip>
        <span class="font-ui-medium text-et-surface">{{ tipText().label }}</span>
        <span class="text-et-surface-muted">{{ tipText().detail }}</span>
        @if (note(); as note) {
          <span class="text-et-surface-muted">{{ note }}</span>
        }
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, TOGGLETIP_IMPORTS, ProvideColorDirective],
  host: { class: 'contents' },
})
export class SketchStatusBadgeComponent {
  private sanitizer = inject(DomSanitizer);
  private errorTheme = injectSemanticColorTheme('error');
  private successTheme = injectSemanticColorTheme('success');

  public status = input<SketchBadgeStatus>('waiting');
  public note = input<string | null>(null);
  public open = input(false);

  protected tipText = computed(() => SKETCHES_LABELS.statusTip[this.status()]);
  protected icon = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICON[this.status()]));
  protected tone = computed(() => TONE[this.status()]);
  protected scope = computed(() => {
    const status = this.status();

    if (status === 'failed') return this.errorTheme();

    return status === 'approved' || status === 'autoMerge' ? this.successTheme() : null;
  });
}
