import { Component, ViewEncapsulation } from '@angular/core';
import { TIMELINE_IMPORTS } from '@ethlete/components';
import { TIMELINE_EVENTS } from './timeline.data';

@Component({
  selector: 'app-timeline-compact-example',
  template: `
    <et-timeline class="example-timeline-compact">
      @for (event of EVENTS; track event.label) {
        <et-timeline-item>
          <span etTimelineTime>{{ event.time }}</span>
          <p>{{ event.label }}</p>
        </et-timeline-item>
      }
    </et-timeline>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIMELINE_IMPORTS],
  styles: `
    .example-timeline-compact {
      --et-timeline-gap: 8px;
      --et-timeline-rail-gap: 8px;
      --et-timeline-marker-size: 14px;
      --et-timeline-dot-size: 6px;

      max-inline-size: 520px;
    }

    .example-timeline-compact p {
      margin: 0;
    }
  `,
})
export class TimelineCompactExampleComponent {
  protected readonly EVENTS = TIMELINE_EVENTS;
}
