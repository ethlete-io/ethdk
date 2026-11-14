import { Directive } from '@angular/core';

/**
 * The behavior of a timeline, with no look: the `list` role for the `etTimelineItem`s inside it. `et-timeline`
 * is this directive plus the default rail.
 *
 * @example
 * <ol etTimeline>
 *   <li etTimelineItem status="complete">Kick-off</li>
 * </ol>
 */
@Directive({
  selector: '[etTimeline]',
  exportAs: 'etTimeline',
  host: {
    role: 'list',
  },
})
export class TimelineDirective {}
