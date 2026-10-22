export const TIME_PICKER_EXAMPLES = {
  'time-picker/time-picker-default': () =>
    import('./time-picker-default.example').then((m) => m.TimePickerDefaultExampleComponent),
  'time-picker/time-picker-fine-steps': () =>
    import('./time-picker-fine-steps.example').then((m) => m.TimePickerFineStepsExampleComponent),
  'time-picker/time-picker-opening-hours': () =>
    import('./time-picker-opening-hours.example').then((m) => m.TimePickerOpeningHoursExampleComponent),
  'time-picker/time-picker-range': () =>
    import('./time-picker-range.example').then((m) => m.TimePickerRangeExampleComponent),
  'time-picker/time-picker-range-end-after-start': () =>
    import('./time-picker-range-end-after-start.example').then((m) => m.TimePickerRangeEndAfterStartExampleComponent),
  'time-picker/time-picker-range-with-days-overnight': () =>
    import('./time-picker-range-with-days-overnight.example').then(
      (m) => m.TimePickerRangeWithDaysOvernightExampleComponent,
    ),
  'time-picker/time-picker-twelve-hour': () =>
    import('./time-picker-twelve-hour.example').then((m) => m.TimePickerTwelveHourExampleComponent),
};
