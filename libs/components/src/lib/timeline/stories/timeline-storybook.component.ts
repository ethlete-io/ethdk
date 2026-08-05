import { Component, input, ViewEncapsulation } from '@angular/core';
import {
  CIRCLE_CHECK_ICON,
  CLOCK_ICON,
  ICON_IMPORTS,
  provideIcons,
  RegisteredIconName,
  TRIANGLE_EXCLAMATION_ICON,
  TROPHY_ICON,
} from '../../icon';
import { TIMELINE_IMPORTS } from '../timeline.imports';

type TimelineStoryEvent = {
  time: string;
  label: string;
  description: string;
  icon: RegisteredIconName;
  color: string | null;
};

@Component({
  selector: 'et-sb-timeline',
  template: `
    <div [style.max-inline-size.px]="520" class="p-8 font-sans">
      <et-timeline
        [style.--et-timeline-gap]="compact() ? '8px' : null"
        [style.--et-timeline-rail-gap]="compact() ? '8px' : null"
        [style.--et-timeline-marker-size]="compact() ? '14px' : null"
        [style.--et-timeline-dot-size]="compact() ? '6px' : null"
      >
        @for (event of EVENTS; track event.label) {
          <et-timeline-item [color]="showMarkers() ? event.color : null">
            @if (showTime()) {
              <span etTimelineTime>{{ event.time }}</span>
            }

            @if (showMarkers()) {
              <i [etIcon]="event.icon" etTimelineMarker></i>
            }

            <p class="text-medium m-0">{{ event.label }}</p>

            @if (!compact()) {
              <p [style.color]="'var(--et-surface-color-muted-solid)'" class="text-small m-0">
                {{ event.description }}
              </p>
            }
          </et-timeline-item>
        }
      </et-timeline>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...TIMELINE_IMPORTS, ...ICON_IMPORTS],
  providers: [provideIcons(CLOCK_ICON, CIRCLE_CHECK_ICON, TRIANGLE_EXCLAMATION_ICON, TROPHY_ICON)],
})
export class TimelineStorybookComponent {
  public showTime = input(true);
  public showMarkers = input(false);
  public compact = input(false);

  protected readonly EVENTS: TimelineStoryEvent[] = [
    {
      time: '18:30',
      label: 'Squad announced',
      description: 'Both line-ups published 60 minutes before kickoff.',
      icon: 'et-clock',
      color: null,
    },
    {
      time: "23'",
      label: 'Goal by A. Rossi',
      description: 'Assisted by M. Keller after a counter down the left.',
      icon: 'et-circle-check',
      color: 'success',
    },
    {
      time: "67'",
      label: 'Second yellow for L. Turner',
      description: 'Sent off; the home side plays the rest a player down.',
      icon: 'et-triangle-exclamation',
      color: 'danger',
    },
    {
      time: "90+4'",
      label: 'Fulltime - 2:1',
      description: 'The visitors take all three points and go top of the table.',
      icon: 'et-trophy',
      color: 'brand',
    },
  ];
}
