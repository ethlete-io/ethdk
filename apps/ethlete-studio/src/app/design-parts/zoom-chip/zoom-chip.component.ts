import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, TOOLTIP_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type ZoomControl = 'out' | 'reset' | 'in' | 'fit';

export type ZoomInteraction = 'hover' | 'active' | 'focus-visible';

@Component({
  selector: 'ethlete-zoom-chip',
  template: `
    <span class="contents" data-camera-out>
      <button
        [attr.data-et-force]="forcedOn('out')"
        [attr.aria-label]="LABELS.out"
        (click)="zoomOut.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
      >
        −
      </button>
    </span>
    <span class="contents" data-camera-reset>
      <button
        [attr.data-et-force]="forcedOn('reset')"
        [attr.aria-label]="LABELS.reset"
        [etTooltip]="LABELS.resetTooltip"
        (click)="zoomReset.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
      >
        {{ percent() }} %
      </button>
    </span>
    <span class="contents" data-camera-in>
      <button
        [attr.data-et-force]="forcedOn('in')"
        [attr.aria-label]="LABELS.in"
        (click)="zoomIn.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
      >
        +
      </button>
    </span>
    <span class="contents" data-camera-fit>
      <button
        [attr.data-et-force]="forcedOn('fit')"
        [attr.aria-label]="LABELS.fit"
        [etTooltip]="LABELS.fitTooltip"
        (click)="fit.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        placement="top-end"
      >
        {{ LABELS.fitButton }}
      </button>
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, TOOLTIP_IMPORTS],
  hostDirectives: [AutoSurfaceDirective],
  host: {
    class:
      'inline-flex rounded-control-md border font-ui border-(--et-overlay-surface-border-color,var(--et-surface-border-solid)) bg-et-surface-bg shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16))',
    'data-canvas-zoom': '',
  },
})
export class ZoomChipComponent {
  public percent = input(100);

  public target = input<ZoomControl | null>(null);
  public interaction = input<ZoomInteraction | null>(null);
  public zoomOut = output();

  public zoomReset = output();
  public zoomIn = output();
  public fit = output();
  protected readonly LABELS = STUDIO_LABELS.zoom;

  protected forcedOn(control: ZoomControl) {
    return this.target() === control ? this.interaction() : null;
  }
}
