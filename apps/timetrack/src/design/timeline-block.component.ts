import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';

/** The colour tokens `colorTokenOf` can put on a band, in the order the day asks about them. */
export const BLOCK_TONES = ['success', 'brand', 'warning', 'pending', 'neutral'] as const;

export type BlockTone = (typeof BLOCK_TONES)[number];

const HOUR_REM = 8;
const LABEL_MIN_REM = 2.2;
const DETAIL_MIN_REM = 5;

@Component({
  selector: 'ethlete-design-band',
  template: `
    <div
      [etProvideColor]="tone()"
      [style.height.rem]="heightRem()"
      [attr.data-compact]="compact() || null"
      [attr.data-dragging]="dragging() || null"
      [attr.data-excluded]="excluded() || null"
      [attr.data-marked]="marked() || null"
      [attr.data-stand-in]="standIn() || null"
      class="flex w-full cursor-grab flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme bg-et-theme/15 px-2 py-1 text-left text-small outline-none hover:bg-et-theme/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-et-theme-ink data-[compact]:py-0 data-[compact]:leading-none data-[dragging]:opacity-70 data-[excluded]:cursor-cell data-[marked]:ring-2 data-[marked]:ring-et-theme-ink data-[marked]:ring-inset data-[stand-in]:border-dashed"
      tabindex="0"
    >
      @if (labelled()) {
        <span class="block truncate">{{ label() }}</span>
      }
      @if (detailed() && detail()) {
        <span class="block truncate text-et-surface-muted">{{ detail() }}</span>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
})
export class TimelineBlockComponent {
  public tone = input<BlockTone>('brand');
  public label = input('');
  public detail = input('');
  public minutes = input(45);
  public marked = input(false);
  public standIn = input(false);
  public excluded = input(false);
  public dragging = input(false);

  protected heightRem = computed(() => (this.minutes() / 60) * HOUR_REM);
  protected labelled = computed(() => this.heightRem() >= LABEL_MIN_REM - 0.3);
  protected compact = computed(() => this.heightRem() < LABEL_MIN_REM);
  protected detailed = computed(() => this.heightRem() >= DETAIL_MIN_REM);
}
