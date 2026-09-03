import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { describePickerCommitContract } from '../../../testing/picker-commit-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { TIME_RANGE_INPUT_ERROR_CODES } from '../time-range-input-errors';
import { TimeRangeInputFieldDirective } from './time-range-input-field.directive';
import { TimeRangeInputDirective, TimeRangeValue } from './time-range-input.directive';
import { DatePickerDriver, mountDatePicker } from '../../../testing/date-picker-driver';
import { pressKey, tick } from '../../../../testing/driver-core';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      [readonly]="readonly()"
      displayFormat="HH:mm"
      etTimeRangeInput
      valueFormat="HH:mm"
    >
      <input class="start" etTimeRangeInputField side="start" />
      <input class="end" etTimeRangeInputField side="end" />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-rangeInput>
        <button (click)="rangeInput.selectTime('start', pickTime)" class="pick-start-time" type="button">
          start time
        </button>
        <button (click)="rangeInput.selectTime('end', pickTime)" class="pick-end-time" type="button">end time</button>
      </ng-template>
    </div>
  `,
  imports: [
    TimeRangeInputDirective,
    TimeRangeInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
  ],
})
class TimeRangeInputTestHost {
  value = signal<TimeRangeValue>({ start: null, end: null });
  mixed = signal(false);
  disabled = signal(false);
  readonly = signal(false);
  pickTime = new Date(2026, 0, 1, 21, 45);
}

@Component({
  template: `
    <div etTimeRangeInput>
      <input etTimeRangeInputField side="start" />
      <input etTimeRangeInputField side="start" />
    </div>
  `,
  imports: [TimeRangeInputDirective, TimeRangeInputFieldDirective],
})
class DuplicateTimeRangeInputFieldTestHost {}

/** The wire values parse against today, so expectations about `Date`s have to be built on it too. */
const today = (hours: number, minutes: number) => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
};

describe('TimeRangeInputDirective', () => {
  let driver: DatePickerDriver<TimeRangeInputTestHost, TimeRangeInputDirective>;

  beforeEach(() => {
    driver = mountDatePicker(TimeRangeInputTestHost, TimeRangeInputDirective);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('commits each side independently on blur', () => {
    driver.typeAndBlur('09:00', '.start');

    expect(driver.host.value()).toEqual({ start: '09:00', end: null });

    driver.typeAndBlur('17:30', '.end');

    expect(driver.host.value()).toEqual({ start: '09:00', end: '17:30' });
    expect(driver.control.parseError()).toBe(false);
    expect(driver.control.touched()).toBe(true);
  });

  it('commits lenient entry per side and reformats it', () => {
    driver.typeAndBlur('930', '.start');

    expect(driver.host.value().start).toBe('09:30');
    expect(driver.field('.start').value).toBe('09:30');

    driver.typeAndBlur('930pm', '.end');

    expect(driver.host.value().end).toBe('21:30');
    expect(driver.field('.end').value).toBe('21:30');
  });

  it('tracks a per-side parse error without touching the other side', () => {
    driver.typeAndBlur('09:00', '.start');
    driver.typeAndBlur('nope', '.end');

    expect(driver.host.value()).toEqual({ start: '09:00', end: null });
    expect(driver.control.sideParseError('start')).toBe(false);
    expect(driver.control.sideParseError('end')).toBe(true);
    expect(driver.control.shouldDisplayError()).toBe(true);
    expect(driver.field('.end').value).toBe('nope');
  });

  it('leaves an end before the start alone - ordering is a validator concern', () => {
    driver.typeAndBlur('17:30', '.start');
    driver.typeAndBlur('09:00', '.end');

    expect(driver.host.value()).toEqual({ start: '17:30', end: '09:00' });
  });

  it('displays a prefilled range in the display format', async () => {
    driver.host.value.set({ start: '09:15', end: '18:00' });
    tick();
    await driver.fixture.whenStable();

    expect(driver.field('.start').value).toBe('09:15');
    expect(driver.field('.end').value).toBe('18:00');
    expect(driver.control.calendarRange()).toEqual({ start: today(9, 15), end: today(18, 0) });
  });

  it('commits a picked time into that side only, and keeps the picker open', async () => {
    driver.host.value.set({ start: '09:15', end: '18:00' });
    tick();

    await driver.open();

    driver.clickInPane('.pick-end-time');

    expect(driver.host.value()).toEqual({ start: '09:15', end: '21:45' });
    // one end filled is only half a range - the other is still to come
    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.control.touched()).toBe(true);

    driver.clickInPane('.pick-start-time');

    expect(driver.host.value()).toEqual({ start: '21:45', end: '21:45' });
  });

  it('clears both sides', () => {
    driver.typeAndBlur('09:00', '.start');
    driver.typeAndBlur('17:30', '.end');

    driver.control.clearRange();
    tick();

    expect(driver.host.value()).toEqual({ start: null, end: null });
    expect(driver.control.hasValue()).toBe(false);
    expect(driver.field('.start').value).toBe('');
    expect(driver.field('.end').value).toBe('');
  });

  it('opens the picker with Alt+ArrowDown from either field', async () => {
    driver.field('.end').focus();
    pressKey(driver.field('.end'), 'ArrowDown', { altKey: true });
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', () => {
    driver.host.disabled.set(true);
    tick();

    expect(driver.trigger<HTMLButtonElement>().disabled).toBe(true);
    expect(driver.field('.start').disabled).toBe(true);

    driver.control.openPicker();
    tick();

    expect(driver.control.pickerOpen()).toBe(false);
  });

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      driver.host.value.set({ start: '08:15', end: '19:45' });
      driver.host.mixed.set(true);
      tick();
    };

    it('renders both fields empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(driver.field('.start').value).toBe('');
      expect(driver.field('.end').value).toBe('');
      expect(driver.field('.start').getAttribute('placeholder')).toBe('Mixed');
      expect(driver.control.calendarRange()).toEqual({ start: null, end: null });
      expect(driver.control.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw range on a failed typed parse', () => {
      enterMixed();
      driver.typeAndBlur('nope', '.start');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toEqual({ start: '08:15', end: '19:45' });
      expect(driver.control.parseError()).toBe(true);
    });

    it('starts a fresh range on the first typed commit - the hidden other side does not leak', () => {
      enterMixed();
      driver.typeAndBlur('17:30', '.end');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual({ start: null, end: '17:30' });
    });

    it('replaces on a picked time: the hidden other side does not survive', async () => {
      enterMixed();
      await driver.open();

      driver.clickInPane('.pick-start-time');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual({ start: '21:45', end: null });
    });
  });
});

describe('TimeRangeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    const driver = mountDatePicker(TimeRangeInputTestHost, TimeRangeInputDirective);

    return {
      enterMixed: () => {
        driver.host.value.set({ start: '08:15', end: '19:45' });
        driver.host.mixed.set(true);
        tick();
      },
      rawValue: () => ({ start: '08:15', end: '19:45' }),
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set({ start: '12:00', end: '13:00' });
        tick();
      },
      externallyWrittenValue: () => ({ start: '12:00', end: '13:00' }),
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        tick();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.field('.start').placeholder,
      // replace semantics: the resolving commit starts a fresh range - no merge with the hidden end
      commit: () => driver.typeAndBlur('14:30', '.start'),
      committedValue: () => ({ start: '14:30', end: null }),
      assertMasked: () => {
        expect(driver.control.calendarRange()).toEqual({ start: null, end: null });
        expect(driver.field('.start').value).toBe('');
        expect(driver.field('.end').value).toBe('');
        expect(driver.field('.start').getAttribute('placeholder')).toBe('Mixed');
        expect(driver.field('.end').getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        driver.control.clearRange();
        tick();
      },
      emptyValue: () => ({ start: null, end: null }),
    };
  });
});

describe('TimeRangeInputDirective commit contract', () => {
  describePickerCommitContract(() => {
    const driver = mountDatePicker(TimeRangeInputTestHost, TimeRangeInputDirective);

    return {
      commitValue: () => driver.typeAndBlur('14:30', '.start'),
      committedValue: () => ({ start: '14:30', end: null }),
      emptyValue: () => ({ start: null, end: null }),
      value: () => driver.host.value(),
      parseError: () => driver.control.sideParseError('start'),
      focus: () => driver.focusField('.start'),
      blur: () => driver.blurField('.start'),
      typeAndBlur: (text: string) => driver.typeAndBlur(text, '.start'),
      makeReadonly: () => {
        driver.host.readonly.set(true);
        tick();
      },
    };
  });
});

describe('TimeRangeInputDirective errors', () => {
  it('rejects a second field for the same side', () => {
    TestBed.configureTestingModule({ imports: [DuplicateTimeRangeInputFieldTestHost] });

    expect(() => {
      const fixture = TestBed.createComponent(DuplicateTimeRangeInputFieldTestHost);
      fixture.detectChanges();
    }).toThrow(`ET${TIME_RANGE_INPUT_ERROR_CODES.DUPLICATE_FIELD}`);
  });
});
