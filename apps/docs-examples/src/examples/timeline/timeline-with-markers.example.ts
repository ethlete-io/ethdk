import { Component, ViewEncapsulation } from '@angular/core';
import {
  CIRCLE_CHECK_ICON,
  CLOCK_ICON,
  ICON_IMPORTS,
  TIMELINE_IMPORTS,
  TRIANGLE_EXCLAMATION_ICON,
  TROPHY_ICON,
  provideIcons,
} from '@ethlete/components';
import { TIMELINE_EVENTS } from './timeline.data';

@Component({
  selector: 'app-timeline-with-markers-example',
  template: `
    <et-timeline class="example-timeline">
      @for (event of EVENTS; track event.label) {
        <et-timeline-item [color]="event.color">
          <span etTimelineTime>{{ event.time }}</span>
          <i [etIcon]="event.icon" etTimelineMarker></i>
          <p class="example-timeline-label">{{ event.label }}</p>
          <p class="example-timeline-description">{{ event.description }}</p>
        </et-timeline-item>
      }
    </et-timeline>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIMELINE_IMPORTS, ICON_IMPORTS],
  providers: [provideIcons(CLOCK_ICON, CIRCLE_CHECK_ICON, TRIANGLE_EXCLAMATION_ICON, TROPHY_ICON)],
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
export class TimelineWithMarkersExampleComponent {
  protected readonly EVENTS = TIMELINE_EVENTS;
}
