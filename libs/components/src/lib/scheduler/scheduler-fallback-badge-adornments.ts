import { SchedulerBadgeAdornment } from './headless';
import { SchedulerBadgeTimeRangeComponent } from './scheduler-badge-time-range.component';
import { SchedulerBadgeTitleComponent } from './scheduler-badge-title.component';

export const SCHEDULER_FALLBACK_BADGE_ADORNMENTS: readonly SchedulerBadgeAdornment[] = [
  { component: SchedulerBadgeTitleComponent, order: 0 },
  { component: SchedulerBadgeTimeRangeComponent, order: 10 },
];
