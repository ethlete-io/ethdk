import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-calendar-custom-header-example',
  template: `
    <et-calendar [(value)]="value">
      <ng-template etCalendarHeader let-calendar>
        <div class="app-calendar-header">
          <button [disabled]="!calendar.canGoPrev()" (click)="calendar.previous()" type="button">Back</button>

          <button (click)="calendar.zoomOut()" type="button">
            {{ calendar.headerLabel() }} ({{ calendar.view() }})
          </button>

          <button [disabled]="!calendar.canGoNext()" (click)="calendar.next()" type="button">Next</button>
        </div>
      </ng-template>
    </et-calendar>

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
  styles: `
    .app-calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-block-end: 8px;

      & button {
        padding: 4px 8px;
        border: 1px solid var(--et-surface-border-solid);
        border-radius: 6px;
        background: transparent;
        font: inherit;
        font-size: 12px;
        color: inherit;
        cursor: pointer;
      }

      & button:disabled {
        opacity: 0.4;
        cursor: default;
      }
    }
  `,
})
export class CalendarCustomHeaderExampleComponent {
  protected value = signal<Date | null>(null);
}
