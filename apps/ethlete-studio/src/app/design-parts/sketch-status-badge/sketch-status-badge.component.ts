import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, ICON_IMPORTS, provideIcons, TOGGLETIP_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SKETCH_STATUS_ICONS, SKETCH_STATUS_TONE, SketchBadgeStatus } from '../../icons/sketch-status-icons';

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
        <i [etIcon]="icon()" [class]="tone()" class="flex size-4" data-sk-status-icon></i>
      </button>
    </span>
    <ng-template #tip>
      <div class="flex max-w-64 flex-col gap-space-1 text-ui-sm" data-toggletip-body data-sk-status-tip>
        <span class="font-ui-medium text-et-surface-text">{{ tipText().label }}</span>
        <span class="text-et-surface-text-muted">{{ tipText().detail }}</span>
        @if (note(); as note) {
          <span class="text-et-surface-text-muted">{{ note }}</span>
        }
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ICON_IMPORTS, TOGGLETIP_IMPORTS, ProvideColorDirective],
  providers: [provideIcons(...Object.values(SKETCH_STATUS_ICONS))],
  host: { class: 'contents' },
})
export class SketchStatusBadgeComponent {
  private errorTheme = injectSemanticColorTheme('error');
  private successTheme = injectSemanticColorTheme('success');

  public status = input<SketchBadgeStatus>('waiting');
  public note = input<string | null>(null);
  public open = input(false);

  protected tipText = computed(() => SKETCHES_LABELS.statusTip[this.status()]);
  protected icon = computed(() => SKETCH_STATUS_ICONS[this.status()].name);
  protected tone = computed(() => SKETCH_STATUS_TONE[this.status()]);
  protected scope = computed(() => {
    const status = this.status();

    if (status === 'failed') return this.errorTheme();

    return status === 'approved' || status === 'autoMerge' ? this.successTheme() : null;
  });
}
