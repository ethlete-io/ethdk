import { Component, computed, ElementRef, input, viewChild, ViewEncapsulation } from '@angular/core';
import { SpinnerComponent } from '@ethlete/components';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';

export type VariantCellMark = { left: number; top: number; width: number; height: number };

const FRAME_RING = 'shadow-[0_0_0_1px_var(--et-surface-border-solid)]';
const SELECTED_RING = 'outline-2 -outline-offset-2 outline-(--et-theme-color-primary-solid) outline-solid';

@Component({
  selector: 'ethlete-variant-cell',
  templateUrl: './variant-cell.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent],
  host: {
    class: 'row-span-2 grid min-w-0 grid-rows-subgrid gap-y-space-1',
    '[attr.data-sk-state]': 'state()',
    '[attr.data-sk-variant]': 'variant() || null',
    '[attr.data-sk-changed]': 'changed() || null',
    '[style.grid-column]': 'column()',
    '[style.grid-row]': 'line()',
    '[style.--sk-scale]': 'scale()',
  },
})
export class VariantCellComponent {
  public state = input('');
  public variant = input('');
  public changed = input('');

  public column = input<number | null>(null);
  public line = input<number | null>(null);
  public scale = input(1);
  public labelFont = input(13);
  public labelHidden = input(false);
  public stateHidden = input(false);
  public same = input(false);
  public sameAsRest = input<readonly string[]>([]);
  public loading = input(false);
  public frameKey = input('');
  public width = input(0);
  public rowWidth = input(0);
  public height = input<number>();
  public shown = input<number>();
  public crop = input<string | null>(null);
  public mark = input<VariantCellMark | null>(null);
  public stacked = input(false);
  public selected = input(false);
  public frameRef = viewChild<ElementRef<HTMLElement>>('frame');
  public labelRowRef = viewChild<ElementRef<HTMLElement>>('labelRow');
  public stateLabelRef = viewChild<ElementRef<HTMLElement>>('stateLabel');

  protected readonly LABELS = SKETCHES_LABELS;
  protected readonly STACK_INSETS = [32, 64];
  protected readonly SELECTED_RING_CLASS = SELECTED_RING;

  protected frameWidth = computed(() => this.width() * this.scale());
  protected shownHeight = computed(() => this.shown() ?? this.height() ?? 0);
  protected frameClass = computed(() => (this.stacked() ? 'z-1' : FRAME_RING));
  protected wrapperClass = computed(() => (this.stacked() ? FRAME_RING : ''));
}
