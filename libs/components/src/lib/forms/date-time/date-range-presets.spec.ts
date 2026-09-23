import { Component, signal } from '@angular/core';
import { Locale } from 'date-fns';
import { de } from 'date-fns/locale';
import '../../../test-helpers';
import { DatePickerDriver, mountDatePicker } from '../testing/date-picker-driver';
import { DateRangeInputComponent } from './date-range-input/date-range-input.component';
import { DateRangeInputDirective, DateRangeValue } from './date-range-input/headless';
import {
  DateRangePreset,
  lastDaysPreset,
  lastMonthPreset,
  lastWeekPreset,
  nextDaysPreset,
  thisMonthPreset,
  thisWeekPreset,
  thisYearPreset,
  todayPreset,
  yesterdayPreset,
} from './date-range-presets';
import { DEFAULT_DATE_TIME_LABELS, provideDateTimeLabels } from './date-time-labels';
import { DateTimeRangeInputComponent } from './date-time-range-input/date-time-range-input.component';
import { DateTimeRangeInputDirective } from './date-time-range-input/headless';

const NOW = new Date(2026, 6, 15, 10, 30);

const resolved = (preset: DateRangePreset, locale: Locale | null = null) => {
  const { start, end } = preset.resolve(NOW, { locale });

  return [start.toString(), end.toString()];
};

const dayRange = (start: Date, end: Date) => {
  const endAt = new Date(end);

  endAt.setHours(23, 59, 0, 0);

  return [start.toString(), endAt.toString()];
};

describe('preset factories', () => {
  it.each<[string, DateRangePreset, [Date, Date]]>([
    ['todayPreset', todayPreset(), [new Date(2026, 6, 15), new Date(2026, 6, 15)]],
    ['yesterdayPreset', yesterdayPreset(), [new Date(2026, 6, 14), new Date(2026, 6, 14)]],
    ['lastDaysPreset(7)', lastDaysPreset(7), [new Date(2026, 6, 9), new Date(2026, 6, 15)]],
    ['nextDaysPreset(7)', nextDaysPreset(7), [new Date(2026, 6, 16), new Date(2026, 6, 22)]],
    ['thisMonthPreset', thisMonthPreset(), [new Date(2026, 6, 1), new Date(2026, 6, 31)]],
    ['lastMonthPreset', lastMonthPreset(), [new Date(2026, 5, 1), new Date(2026, 5, 30)]],
    ['thisYearPreset', thisYearPreset(), [new Date(2026, 0, 1), new Date(2026, 11, 31)]],
  ])('%s runs from 00:00 on its first day to 23:59 on its last', (_, preset, [start, end]) => {
    expect(resolved(preset)).toEqual(dayRange(start, end));
  });

  it('starts the week where the locale does', () => {
    expect(resolved(thisWeekPreset())).toEqual(dayRange(new Date(2026, 6, 12), new Date(2026, 6, 18)));
    expect(resolved(thisWeekPreset(), de)).toEqual(dayRange(new Date(2026, 6, 13), new Date(2026, 6, 19)));
    expect(resolved(lastWeekPreset(), de)).toEqual(dayRange(new Date(2026, 6, 6), new Date(2026, 6, 12)));
  });

  it('reads its label from DATE_TIME_LABELS unless given one', () => {
    const { label } = lastDaysPreset(30);

    expect(typeof label === 'function' ? label(DEFAULT_DATE_TIME_LABELS) : label).toBe('Last 30 days');
    expect(thisMonthPreset({ label: 'Dieser Monat' }).label).toBe('Dieser Monat');
  });
});

@Component({
  template: `
    <et-date-range-input [(value)]="value" [presets]="presets()" aria-label="Stay" valueFormat="yyyy-MM-dd" />
  `,
  imports: [DateRangeInputComponent],
})
class DateRangePresetsHost {
  value = signal<DateRangeValue>({ start: null, end: null });
  presets = signal<DateRangePreset[]>([lastDaysPreset(7), thisMonthPreset()]);
}

@Component({
  template: `<et-date-time-range-input [(value)]="value" [presets]="presets" aria-label="Slot" />`,
  imports: [DateTimeRangeInputComponent],
})
class DateTimeRangePresetsHost {
  value = signal<DateRangeValue>({ start: null, end: null });
  presets = [todayPreset()];
}

describe('et-date-range-input presets', () => {
  let driver: DatePickerDriver<DateRangePresetsHost, DateRangeInputDirective>;

  const presetButtons = () => driver.paneEls<HTMLButtonElement>('.et-date-range-preset');
  const pressedStates = () => presetButtons().map((button) => button.getAttribute('aria-pressed'));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    driver = mountDatePicker(DateRangePresetsHost, DateRangeInputDirective, [
      provideDateTimeLabels({ presets: 'Quick ranges' }),
    ]);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
    vi.useRealTimers();
  });

  it('renders a labelled group with one toggle button per preset, none pressed', async () => {
    await driver.open();

    expect(driver.paneEl('.et-date-range-presets')?.getAttribute('role')).toBe('group');
    expect(driver.paneEl('.et-date-range-presets')?.getAttribute('aria-label')).toBe('Quick ranges');
    expect(presetButtons().map((button) => button.textContent?.trim())).toEqual(['Last 7 days', 'This month']);
    expect(pressedStates()).toEqual(['false', 'false']);
  });

  it('commits the picked range at day precision and closes the picker', async () => {
    await driver.open();
    driver.click(presetButtons()[1]!);

    expect(driver.host.value()).toEqual({ start: '2026-07-01', end: '2026-07-31' });
    expect(driver.control.pickerOpen()).toBe(false);
    expect(driver.control.touched()).toBe(true);
  });

  it('marks the preset whose range equals the value as pressed', async () => {
    driver.host.value.set({ start: '2026-07-09', end: '2026-07-15' });
    await driver.open();

    expect(pressedStates()).toEqual(['true', 'false']);

    driver.host.value.set({ start: '2026-07-09', end: '2026-07-16' });
    driver.tick();

    expect(pressedStates()).toEqual(['false', 'false']);
  });

  it('renders no preset list without presets', async () => {
    driver.host.presets.set([]);
    await driver.open();

    expect(driver.paneEl('.et-date-range-presets')).toBeNull();
    expect(driver.paneEl('et-calendar')).not.toBeNull();
  });
});

describe('et-date-time-range-input presets', () => {
  let driver: DatePickerDriver<DateTimeRangePresetsHost, DateTimeRangeInputDirective>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    driver = mountDatePicker(DateTimeRangePresetsHost, DateTimeRangeInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
    vi.useRealTimers();
  });

  it('commits 00:00 to 23:59, keeps the picker open and marks the preset pressed', async () => {
    await driver.open();

    const preset = driver.paneEl<HTMLButtonElement>('.et-date-range-preset')!;

    driver.click(preset);

    const { start, end } = driver.host.value();

    expect(new Date(start!)).toEqual(new Date(2026, 6, 15, 0, 0));
    expect(new Date(end!)).toEqual(new Date(2026, 6, 15, 23, 59));
    expect(driver.control.pickerOpen()).toBe(true);
    expect(preset.getAttribute('aria-pressed')).toBe('true');
  });
});
