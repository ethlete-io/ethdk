import { computed, Signal } from '@angular/core';
import { DateRangePreset, DateRangePresetOption, DateRangePresetRange } from '../date-range-presets';
import { DateTimeLabels } from '../date-time-labels';
import { DateRangePickerInputDirective } from './date-range-picker-input.directive';
import { reinterpretInZone, zonedProxy } from './time-zone';

export type CreateDateRangePresetsOptions = {
  host: DateRangePickerInputDirective;
  presets: Signal<readonly DateRangePreset[]>;
  labels: Signal<DateTimeLabels>;
  /** Snaps a resolved wall-clock end onto what the control stores - a day range drops the time. */
  normalize: (date: Date) => Date;
};

/** The preset state a range input shares with its styled component. Call in an injection context. */
export const createDateRangePresets = ({ host, presets, labels, normalize }: CreateDateRangePresetsOptions) => {
  const resolveInstants = (preset: DateRangePreset): DateRangePresetRange => {
    const timeZone = host.effectiveTimeZone();
    const now = timeZone === null ? new Date() : zonedProxy(new Date(), timeZone);
    const range = preset.resolve(now, { locale: host.effectiveLocale() });

    return {
      start: reinterpretInZone(normalize(range.start), timeZone),
      end: reinterpretInZone(normalize(range.end), timeZone),
    };
  };

  const options = computed<DateRangePresetOption[]>(() => {
    const value = host.value();
    const mixed = host.mixed();
    const currentLabels = labels();

    return presets().map((preset) => {
      const range = resolveInstants(preset);

      return {
        preset,
        label: typeof preset.label === 'string' ? preset.label : preset.label(currentLabels),
        active: !mixed && value.start === host.formatSide(range.start) && value.end === host.formatSide(range.end),
      };
    });
  });

  return {
    options,
    /** Writes the preset's range, or does nothing while the control is not interactive. */
    apply: (preset: DateRangePreset) => {
      if (!host.interactive()) return false;

      host.writeRange(resolveInstants(preset));
      host.touched.set(true);

      return true;
    },
  };
};
