import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { MINUTES } from './fixture';

const HOUR_REM = 8;
const LABEL_MIN_REM = 2.2;
const DETAIL_MIN_REM = 5;

@Component({
  selector: 'ethlete-design-timeline-ref-durations-band',
  template: `
    <div
      [style.height.rem]="heightRem()"
      [attr.data-compact]="compact() || null"
      class="et-color--success flex w-full cursor-grab flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme bg-et-theme/15 px-2 py-1 text-left text-small outline-none hover:bg-et-theme/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-et-theme-ink data-[compact]:py-0 data-[compact]:leading-none"
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
class DurationsBandComponent {
  public label = input('');
  public detail = input('');
  public minutes = input(45);

  protected heightRem = computed(() => (this.minutes() / 60) * HOUR_REM);
  protected labelled = computed(() => this.heightRem() >= LABEL_MIN_REM - 0.3);
  protected compact = computed(() => this.heightRem() < LABEL_MIN_REM);
  protected detailed = computed(() => this.heightRem() >= DETAIL_MIN_REM);
}

@Component({
  selector: 'ethlete-design-timeline-ref-durations',
  template: `
    <div class="et-surface--dark flex items-start gap-4 bg-et-surface-bg p-10 text-et-surface">
      @for (m of MINUTES; track m) {
        <div class="flex w-56 flex-col gap-2">
          <span class="text-mono text-et-surface-subtle">{{ m }}m</span>
          <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
            <ethlete-design-timeline-ref-durations-band
              [minutes]="m"
              detail="feat(repo): Answer the parent with the epic"
              label="ET-772"
            />
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DurationsBandComponent],
})
export default class TimelineRefDurationsComponent {
  protected readonly MINUTES = MINUTES;
}
