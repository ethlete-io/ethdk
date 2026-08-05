import { Component, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';

/**
 * One event on an `et-timeline`: a marker on the rail plus whatever content describes it. Project
 * `[etTimelineTime]` for the timestamp above the content, and `[etTimelineMarker]` to replace the
 * default dot with an icon or an avatar. `color` scopes a color theme to this item, which is what
 * tints its marker.
 *
 * @example
 * <et-timeline-item color="error">
 *   <span etTimelineTime>14:02</span>
 *   <i etTimelineMarker etIcon="et-triangle-exclamation"></i>
 *   <p>Deployment failed</p>
 * </et-timeline-item>
 */
@Component({
  selector: 'et-timeline-item',
  templateUrl: './timeline-item.component.html',
  styleUrl: './timeline-item.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-timeline-item',
    role: 'listitem',
  },
})
export class TimelineItemComponent {}
