import { Component, computed, input, ViewEncapsulation } from '@angular/core';
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

const LABELS = SKETCHES_LABELS.status;

const DOT: Record<SketchBadgeStatus, string> = {
  drawing: 'bg-(--et-theme-color-primary-solid) animate-pulse',
  waiting: 'bg-(--et-theme-color-primary-solid)',
  paused: 'bg-et-surface-muted',
  failed: 'bg-(--et-theme-color-primary-solid)',
  merging: 'bg-(--et-theme-color-primary-solid) animate-pulse',
  autoMerge: 'bg-(--et-theme-color-primary-solid)',
  awaitingApproval: 'bg-(--et-theme-color-primary-solid)',
  awaitingSubParts: 'bg-(--et-theme-color-primary-solid)',
  approved: 'bg-(--et-theme-color-primary-solid)',
};

@Component({
  selector: 'ethlete-sketch-status-badge',
  template: `
    <span
      [etProvideColor]="failed() ? errorTheme() : null"
      [class]="failed() ? 'text-(--et-theme-color-primary-solid)' : 'text-et-surface'"
      [attr.data-sk-status]="status()"
      class="flex w-fit items-center gap-space-2 text-ui-sm font-ui-medium whitespace-nowrap"
    >
      <span
        [etProvideColor]="succeeded() ? successTheme() : null"
        [class]="dot()"
        class="size-2 flex-none rounded-full"
        data-sk-status-dot
      ></span
      >{{ label() }}
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: { class: 'contents' },
})
export class SketchStatusBadgeComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  protected successTheme = injectSemanticColorTheme('success');

  public status = input<SketchBadgeStatus>('waiting');
  protected failed = computed(() => this.status() === 'failed');
  protected succeeded = computed(() => ['approved', 'autoMerge'].includes(this.status()));
  protected label = computed(() => LABELS[this.status()]);
  protected dot = computed(() => DOT[this.status()]);
}
