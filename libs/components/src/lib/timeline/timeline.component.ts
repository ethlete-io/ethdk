import { Component, ViewEncapsulation } from '@angular/core';

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
  host: {
    class: 'et-timeline',
    role: 'list',
  },
})
export class TimelineComponent {}
