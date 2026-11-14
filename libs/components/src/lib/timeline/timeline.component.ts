import { Component, ViewEncapsulation } from '@angular/core';
import { TimelineDirective } from './headless/timeline.directive';

/**
 * A vertical rail of chronological events - an activity feed, an audit log, a match report. Project
 * `et-timeline-item`s in the order they should read; the connecting line and the markers are drawn
 * for you.
 *
 * Reach for `et-progress-steps` instead when the items are the stages of one linear process rather
 * than things that already happened.
 *
 * @example
 * <et-timeline>
 *   <et-timeline-item>
 *     <span etTimelineTime>09:15</span>
 *     <p>Match kicked off</p>
 *   </et-timeline-item>
 *   <et-timeline-item color="success">
 *     <span etTimelineTime>23'</span>
 *     <p>Goal by A. Rossi</p>
 *   </et-timeline-item>
 * </et-timeline>
 */
@Component({
  selector: 'et-timeline',
  template: `<ng-content />`,
  styleUrl: './timeline.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [TimelineDirective],
  host: {
    class: 'et-timeline',
  },
})
export class TimelineComponent {}
