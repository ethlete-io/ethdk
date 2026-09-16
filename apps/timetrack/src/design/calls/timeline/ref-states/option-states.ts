import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { BandCase, BandTone, CASES, MINUTES } from './fixture';

const HOUR_REM = 8;
const LABEL_MIN_REM = 2.2;
const DETAIL_MIN_REM = 5;

const TILE_BASE =
  'flex w-full flex-col overflow-hidden rounded-sm border border-dashed border-et-surface-border px-2 py-1 text-small text-et-surface-muted';

@Component({
  selector: 'ethlete-design-timeline-ref-states-band',
  template: `
    <div
      [class]="'et-color--' + tone()"
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
})
class StatesBandComponent {
  public tone = input<BandTone>('brand');
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

@Component({
  selector: 'ethlete-design-timeline-ref-states',
  template: `
    <div class="et-surface--dark flex flex-wrap gap-4 bg-et-surface-bg p-10 text-et-surface">
      @for (c of CASES; track c.name) {
        <div class="flex w-64 flex-col gap-2">
          <div class="flex items-baseline justify-between text-mono">
            <span>{{ c.name }}</span>
            <span class="text-et-surface-subtle">asks {{ c.asks }}</span>
          </div>
          <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
            <ethlete-design-timeline-ref-states-band
              [detail]="c.detail ?? ''"
              [dragging]="!!c.dragging"
              [excluded]="!!c.excluded"
              [label]="c.label"
              [marked]="!!c.marked"
              [minutes]="MINUTES"
              [standIn]="!!c.standIn"
              [tone]="c.tone"
            />
          </div>
        </div>
      }

      <div class="flex w-64 flex-col gap-2">
        <div class="flex items-baseline justify-between text-mono">
          <span>in the background</span>
          <span class="text-et-surface-subtle">asks nothing</span>
        </div>
        <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
          <div
            [style.height.rem]="HEIGHT_REM"
            class="bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_6px,var(--color-et-surface-border)_6px,var(--color-et-surface-border)_7px)] {{
              TILE_BASE
            }}"
          >
            <span class="block truncate">ET-772 · in the background · 45m</span>
          </div>
        </div>
      </div>

      <div class="flex w-64 flex-col gap-2">
        <div class="flex items-baseline justify-between text-mono">
          <span>break</span>
          <span class="text-et-surface-subtle">asks a click</span>
        </div>
        <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
          <div [style.height.rem]="HEIGHT_REM" class="bg-et-surface-interaction {{ TILE_BASE }}">
            <span class="block truncate">45m</span>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [StatesBandComponent],
  styles: `
    /* The frame runs without the surface directive, so the value the dark theme sets at runtime is written here. */
    ethlete-design-timeline-ref-states {
      --et-surface-interaction: 161 161 161;
    }
  `,
})
export default class TimelineRefStatesComponent {
  protected readonly CASES: BandCase[] = CASES;
  protected readonly MINUTES = MINUTES;
  protected readonly TILE_BASE = TILE_BASE;
  protected readonly HEIGHT_REM = (MINUTES / 60) * HOUR_REM;
}
