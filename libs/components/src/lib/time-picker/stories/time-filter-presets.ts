import { setHours, setMinutes, startOfDay } from 'date-fns';

/**
 * Storybook cannot put `Date`s or functions in its controls, so the time-bound demos
 * take an `HH:mm` string plus a named filter and build the real inputs here. Shared by
 * the time picker, time input and date-time input stories.
 */
export type TimeFilterPreset = 'none' | 'noLunchBreak' | 'weekdayHours';

/** `'09:30'` → today at 09:30. Anything else (including an empty control) is no bound at all. */
export const parseTimeOfDay = (value: string | null) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '');

  if (match === null) {
    return null;
  }

  return setMinutes(setHours(startOfDay(new Date()), Number(match[1])), Number(match[2]));
};

export const resolveTimeFilterPreset = (preset: TimeFilterPreset): ((date: Date) => boolean) | null => {
  switch (preset) {
    case 'noLunchBreak':
      return (date) => date.getHours() !== 12;
    case 'weekdayHours': {
      // the filter sees the full timestamp, so the open hours can differ per weekday
      return (date) => {
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const hour = date.getHours();

        return isWeekend ? hour >= 10 && hour < 14 : hour >= 9 && hour < 17;
      };
    }
    case 'none':
      return null;
  }
};
