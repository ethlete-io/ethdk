import { Component, computed, ElementRef, input, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { SpinnerComponent } from '@ethlete/components';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { moveArrowOf } from './move-arrow';

type MarkBox = { left: number; top: number; width: number; height: number };

/** A changed area of the shot; with `from`, the new place of a part that moved there from `from`. */
export type VariantCellMark = MarkBox & { from?: MarkBox };

// An outset ring is clipped by the frame in WebKit (no overflow-clip-margin), and a border or shadow under 1 px is
// snapped (to 1 px, or to 0 in WebKit) before the zoom preview scales it, so the ring is a 1 px border scaled down.
const FRAME_RING =
  'after:pointer-events-none after:absolute after:top-0 after:left-0 after:size-[calc(100%/var(--sk-stroke-scale,1))] after:origin-top-left after:scale-(--sk-stroke-scale,1) after:border after:border-et-surface-border';

// Chromium and WebKit rasterize a scaled-down iframe's 16 px dot-grid gradient tile as a solid grey fill once
// the tile drops below one CSS pixel, so a cell this small shows its picture instead of the live frame.
const THUMBNAIL_SCALE = 1 / 16;

@Component({
  selector: 'ethlete-variant-cell',
  templateUrl: './variant-cell.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent],
  host: {
    class: 'group/sk-shot row-span-2 grid min-w-0 grid-rows-subgrid gap-y-space-1',
    '[attr.data-sk-state]': 'state()',
    '[attr.data-sk-variant]': 'variant() || null',
    '[attr.data-sk-changed]': 'changed() || null',
    '[attr.data-sk-inherited]': 'inherited() ? "" : null',
    '[attr.data-sk-thumbnail]': 'thumbnail() ? "" : null',
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
  public previewScale = input(1);
  public labelHidden = input(false);
  public stateHidden = input(false);
  public same = input(false);
  public inherited = input(false);
  public sameAsRest = input<readonly string[]>([]);
  public loading = input(false);
  public frameKey = input('');
  public width = input(0);
  public height = input<number>();
  public shown = input<number>();
  public crop = input<string | null>(null);
  public marks = input<readonly VariantCellMark[]>([]);
  public stacked = input<readonly string[]>([]);
  public selected = input(false);
  public frameRef = viewChild<ElementRef<HTMLElement>>('frame');
  public labelRowRef = viewChild<ElementRef<HTMLElement>>('labelRow');
  public stateLabelRef = viewChild<ElementRef<HTMLElement>>('stateLabel');

  protected stackedOpen = signal(false);
  protected readonly LABELS = SKETCHES_LABELS;
  protected readonly STACK_INSETS = [6, 12];

  protected dimmed = computed(() => this.same() || this.inherited());
  protected note = computed(() => (this.inherited() ? this.LABELS.fromSdk : this.same() ? this.LABELS.unchanged : ''));
  protected chromeLength = computed(() => {
    const scale = this.previewScale();

    return (length: string) => (scale === 1 ? null : `calc(${length} / ${scale})`);
  });
  protected frameWidth = computed(() => this.width() * this.scale());
  protected thumbnail = computed(() => this.scale() <= THUMBNAIL_SCALE);
  protected shownHeight = computed(() => this.shown() ?? this.height() ?? 0);
  protected arrows = computed(() =>
    this.marks().flatMap((mark) => {
      const arrow = mark.from ? moveArrowOf(mark.from, mark) : null;

      return arrow ? [arrow] : [];
    }),
  );
  protected frameClass = computed(() => (this.stacked().length > 0 ? `z-1 ${FRAME_RING}` : FRAME_RING));
}
