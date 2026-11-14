import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ProvideColorDirective, mountVisuallyHidden } from '@ethlete/core';
import { IconDirective, provideIcons } from '../icon';
import { PROGRESS_STATE_ICONS, injectProgressStateVisuals } from '../progress-steps/progress-state-visuals';
import { TimelineItemDirective } from './headless/timeline-item.directive';

/**
 * One event on an `et-timeline`: a marker on the rail plus whatever content describes it. Project
 * `[etTimelineTime]` for the timestamp above the content, and `[etTimelineMarker]` to replace the
 * default dot with an icon or an avatar. `color` scopes a color theme to this item, which is what
 * tints its marker.
 *
 * `status` takes the progress-step vocabulary: a resolved status shows its icon in the marker and is
 * announced, and `success`, `warning` and `error` recolor the item in the app's matching semantic theme.
 *
 * @example
 * <et-timeline-item status="error">
 *   <span etTimelineTime>14:02</span>
 *   <p>Deployment failed</p>
 * </et-timeline-item>
 */
@Component({
  selector: 'et-timeline-item',
  templateUrl: './timeline-item.component.html',
  styleUrl: './timeline-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  viewProviders: [provideIcons(...PROGRESS_STATE_ICONS)],
  hostDirectives: [
    { directive: TimelineItemDirective, inputs: ['status'] },
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-timeline-item',
  },
})
export class TimelineItemComponent {
  private item = inject(TimelineItemDirective);
  protected visuals = injectProgressStateVisuals(this.item.status);

  constructor() {
    mountVisuallyHidden();
  }
}
