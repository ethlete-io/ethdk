import { Component, ViewEncapsulation } from '@angular/core';
import { TIMELINE_IMPORTS } from '@ethlete/components';
import { TIMELINE_EVENTS } from './timeline.data';

@Component({
  selector: 'app-timeline-default-example',
  template: `
    <et-timeline class="example-timeline">
      @for (event of EVENTS; track event.label) {
        <et-timeline-item>
          <span etTimelineTime>{{ event.time }}</span>
          <p class="example-timeline-label">{{ event.label }}</p>
          <p class="example-timeline-description">{{ event.description }}</p>
        </et-timeline-item>
      }
    </et-timeline>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIMELINE_IMPORTS],
  styles: `
    .example-timeline {
      max-inline-size: 520px;
    }

    .example-timeline p {
      margin: 0;
    }

    .example-timeline-description {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.4rem;
    }
  `,
})
export class TimelineDefaultExampleComponent {
  protected readonly EVENTS = TIMELINE_EVENTS;
}
