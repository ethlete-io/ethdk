import { Component, ViewEncapsulation, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '../../button';
import { SCHEDULER_IMPORTS } from '../scheduler.imports';
import { SchedulerView } from '../scheduler.types';
import { DEMO_APPOINTMENTS } from './scheduler-storybook.component';

@Component({
  selector: 'et-sb-scheduler-headless',
  template: `
    <div class="p-8 font-sans">
      <div #scheduler="etScheduler" [(view)]="view" [appointments]="APPOINTMENTS" etScheduler>
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <button (click)="scheduler.previous()" et-button variant="outline" size="sm">Previous</button>
          <button (click)="scheduler.goToToday()" et-button variant="outline" size="sm">Today</button>
          <button (click)="scheduler.next()" et-button variant="outline" size="sm">Next</button>

          @for (option of VIEWS; track option) {
            <button
              [variant]="view() === option ? 'filled' : 'transparent'"
              (click)="view.set(option)"
              et-button
              size="sm"
            >
              {{ option }}
            </button>
          }
        </div>

        @switch (view()) {
          @case ('month') {
            <et-scheduler-month-view />
          }
          @case ('agenda') {
            <et-scheduler-agenda-view />
          }
          @default {
            <et-scheduler-time-grid-view class="h-[600px]" />
          }
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SCHEDULER_IMPORTS, ...BUTTON_IMPORTS],
})
export class SchedulerHeadlessStorybookComponent {
  protected readonly APPOINTMENTS = DEMO_APPOINTMENTS;
  protected readonly VIEWS: readonly SchedulerView[] = ['month', 'week', 'day', 'agenda'];
  protected view = signal<SchedulerView>('month');
}
