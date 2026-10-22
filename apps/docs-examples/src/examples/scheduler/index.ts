export const SCHEDULER_EXAMPLES = {
  'scheduler/scheduler-default': () =>
    import('./scheduler-default.example').then((m) => m.SchedulerDefaultExampleComponent),
  'scheduler/scheduler-narrow': () =>
    import('./scheduler-narrow.example').then((m) => m.SchedulerNarrowExampleComponent),
  'scheduler/scheduler-week': () => import('./scheduler-week.example').then((m) => m.SchedulerWeekExampleComponent),
  'scheduler/scheduler-day': () => import('./scheduler-day.example').then((m) => m.SchedulerDayExampleComponent),
  'scheduler/scheduler-business-hours': () =>
    import('./scheduler-business-hours.example').then((m) => m.SchedulerBusinessHoursExampleComponent),
  'scheduler/scheduler-agenda': () =>
    import('./scheduler-agenda.example').then((m) => m.SchedulerAgendaExampleComponent),
};
