import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { BADGE_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';

export type SketchBadgeStatus = 'drawing' | 'waiting' | 'picked' | 'paused' | 'idle' | 'not-ready' | 'failed';

const LABELS = SKETCHES_LABELS.status;

@Component({
  selector: 'ethlete-sketch-status-badge',
  template: `
    <span [etProvideColor]="failed() ? errorTheme() : null" class="flex w-fit">
      <div class="flex flex-wrap items-center">
        <et-badge variant="tonal" size="sm">{{ label() }}</et-badge>
      </div>
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, ProvideColorDirective],
  host: { class: 'contents' },
})
export class SketchStatusBadgeComponent {
  protected errorTheme = injectSemanticColorTheme('error');

  public status = input<SketchBadgeStatus>('waiting');
  protected failed = computed(() => this.status() === 'failed');
  protected label = computed(() => {
    const status = this.status();

    return LABELS[status === 'not-ready' ? 'notReady' : status];
  });
}
