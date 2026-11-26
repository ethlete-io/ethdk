export const DATE_TIME_INPUTS_EXAMPLES = {
  'date-time-inputs/date-input-default': () =>
    import('./date-input-default.example').then((m) => m.DateInputDefaultExampleComponent),
  'date-time-inputs/date-input-masked': () =>
    import('./date-input-masked.example').then((m) => m.DateInputMaskedExampleComponent),
  'date-time-inputs/date-input-month-precision': () =>
    import('./date-input-month-precision.example').then((m) => m.DateInputMonthPrecisionExampleComponent),
  'date-time-inputs/date-range-input-presets': () =>
    import('./date-range-input-presets.example').then((m) => m.DateRangeInputPresetsExampleComponent),
  'date-time-inputs/date-time-input-default': () =>
    import('./date-time-input-default.example').then((m) => m.DateTimeInputDefaultExampleComponent),
  'date-time-inputs/date-time-input-opening-hours': () =>
    import('./date-time-input-opening-hours.example').then((m) => m.DateTimeInputOpeningHoursExampleComponent),
  'date-time-inputs/date-time-input-time-zone': () =>
    import('./date-time-input-time-zone.example').then((m) => m.DateTimeInputTimeZoneExampleComponent),
  'date-time-inputs/date-time-range-input-end-after-start': () =>
    import('./date-time-range-input-end-after-start.example').then(
      (m) => m.DateTimeRangeInputEndAfterStartExampleComponent,
    ),
  'date-time-inputs/date-time-range-input-prefilled': () =>
    import('./date-time-range-input-prefilled.example').then((m) => m.DateTimeRangeInputPrefilledExampleComponent),
  'date-time-inputs/date-time-range-input-time-zone': () =>
    import('./date-time-range-input-time-zone.example').then((m) => m.DateTimeRangeInputTimeZoneExampleComponent),
  'date-time-inputs/time-input-opening-hours': () =>
    import('./time-input-opening-hours.example').then((m) => m.TimeInputOpeningHoursExampleComponent),
  'date-time-inputs/time-range-input-end-after-start': () =>
    import('./time-range-input-end-after-start.example').then((m) => m.TimeRangeInputEndAfterStartExampleComponent),
  'date-time-inputs/time-range-input-prefilled': () =>
    import('./time-range-input-prefilled.example').then((m) => m.TimeRangeInputPrefilledExampleComponent),
};
