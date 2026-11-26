import { Component, ViewEncapsulation } from '@angular/core';
import { TIMELINE_IMPORTS } from '@ethlete/components';
import { TIMELINE_EVENTS } from './timeline.data';

@Component({
  selector: 'app-timeline-status-example',
  template: `
    <et-timeline class="example-timeline-status">
      @for (event of EVENTS; track event.label) {
        <et-timeline-item [status]="event.status">
          <span etTimelineTime>{{ event.time }}</span>
          <p>{{ event.label }}</p>
        </et-timeline-item>
      }
    </et-timeline>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIMELINE_IMPORTS],
  styles: `
    .example-timeline-status {
      max-inline-size: 520px;
    }

    .example-timeline-status p {
      margin: 0;
    }
  `,
})
export class TimelineStatusExampleComponent {
  protected readonly EVENTS = [
    { ...TIMELINE_EVENTS[0], status: 'complete' as const },
    { ...TIMELINE_EVENTS[1], status: 'success' as const },
    { ...TIMELINE_EVENTS[2], status: 'error' as const },
    { ...TIMELINE_EVENTS[3], status: 'current' as const },
  ];
}
