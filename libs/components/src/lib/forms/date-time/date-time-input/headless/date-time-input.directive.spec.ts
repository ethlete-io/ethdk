import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../../../test-helpers';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { describePickerCommitContract } from '../../../testing/picker-commit-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateTimeInputFieldDirective } from './date-time-input-field.directive';
import { DateTimeInputDirective } from './date-time-input.directive';
import { DatePickerDriver, mountDatePicker } from '../../../testing/date-picker-driver';
import { pressKey, tick } from '../../../../testing/driver-core';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      [readonly]="readonly()"
      displayFormat="MM/dd/yyyy, HH:mm"
      etDateTimeInput
      valueFormat="yyyy-MM-dd HH:mm"
    >
      <input etDateTimeInputField />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-dateTimeInput>
        <button (click)="dateTimeInput.selectDate(pickDate)" class="pick-date" type="button">pick date</button>
        <button (click)="dateTimeInput.selectTime(pickTime)" class="pick-time" type="button">pick time</button>
      </ng-template>
    </div>
  `,
  imports: [
    DateTimeInputDirective,
    DateTimeInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
  ],
})
class DateTimeInputTestHost {
  value = signal<string | null>(null);
  mixed = signal(false);
  readonly = signal(false);
  disabled = signal(false);
  pickDate = new Date(2026, 6, 16);
  pickTime = new Date(2026, 0, 1, 21, 45);
}

describe('DateTimeInputDirective', () => {
  let driver: DatePickerDriver<DateTimeInputTestHost, DateTimeInputDirective>;

  beforeEach(() => {
    driver = mountDatePicker(DateTimeInputTestHost, DateTimeInputDirective);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('commits a strict displayFormat parse on blur', () => {
    driver.typeAndBlur('07/16/2026, 14:30');

    expect(driver.host.value()).toBe('2026-07-16 14:30');
    expect(driver.control.parseError()).toBe(false);
    expect(driver.field().value).toBe('07/16/2026, 14:30');
    expect(driver.control.touched()).toBe(true);
  });

  it('commits lenient entry and reformats it', () => {
    driver.typeAndBlur('07/16/2026 930pm');

    expect(driver.host.value()).toBe('2026-07-16 21:30');
    expect(driver.field().value).toBe('07/16/2026, 21:30');
  });

  it('commits a bare date at midnight', () => {
    driver.typeAndBlur('07/16/2026');

    expect(driver.host.value()).toBe('2026-07-16 00:00');
    expect(driver.field().value).toBe('07/16/2026, 00:00');
  });

  it('commits and reformats on Enter without losing focus', () => {
    driver.type('07/16/2026 930');
    driver.pressInField('Enter');

    expect(driver.host.value()).toBe('2026-07-16 09:30');
    expect(driver.field().value).toBe('07/16/2026, 09:30');
  });

  it('keeps unparseable text visible and raises parseError with a null value', () => {
    driver.typeAndBlur('07/16/2026, 14:30');
    driver.typeAndBlur('not a date');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.parseError()).toBe(true);
    expect(driver.control.shouldDisplayError()).toBe(true);
    expect(driver.field().value).toBe('not a date');
    expect(driver.control.hasValue()).toBe(true);
  });

  it('clears the value on empty input', () => {
    driver.typeAndBlur('07/16/2026, 14:30');
    driver.typeAndBlur('');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.parseError()).toBe(false);
    expect(driver.control.hasValue()).toBe(false);
  });

  it('displays a prefilled value in the display format', async () => {
    driver.host.value.set('2026-12-24 09:15');
    tick();
    await driver.fixture.whenStable();

    expect(driver.field().value).toBe('12/24/2026, 09:15');
    expect(driver.control.dateTime()).toEqual(new Date(2026, 11, 24, 9, 15));
  });

  it('merges a picked day into the committed time and keeps the picker open', async () => {
    driver.host.value.set('2026-12-24 09:15');
    tick();

    await driver.open();

    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('true');

    driver.clickInPane('.pick-date');

    expect(driver.host.value()).toBe('2026-07-16 09:15');
    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.control.touched()).toBe(true);
  });

  it('merges a picked time into the committed day and keeps the picker open', async () => {
    driver.host.value.set('2026-12-24 09:15');
    tick();

    await driver.open();

    driver.clickInPane('.pick-time');

    expect(driver.host.value()).toBe('2026-12-24 21:45');
    expect(driver.control.pickerOpen()).toBe(true);
  });

  it('holds a day picked from empty until a time completes it', async () => {
    await driver.open();

    driver.clickInPane('.pick-date');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.hasValue()).toBe(true);
    expect(driver.control.displayValue()).toBe('07/16/2026, __:__');
    expect(driver.control.pickerDate()).toEqual(driver.host.pickDate);
    expect(driver.control.pickerTime()).toBeNull();

    driver.clickInPane('.pick-time');

    expect(driver.host.value()).toBe('2026-07-16 21:45');
    expect(driver.field().value).toBe('07/16/2026, 21:45');
  });

  it('holds a time picked from empty until a day completes it', async () => {
    await driver.open();

    driver.clickInPane('.pick-time');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.displayValue()).toBe('__/__/____, 21:45');
    expect(driver.control.pickerDate()).toBeNull();
    expect(driver.control.pickerTime()).toEqual(driver.host.pickTime);

    driver.clickInPane('.pick-date');

    expect(driver.host.value()).toBe('2026-07-16 21:45');
  });

  it('keeps a held half across an unedited blur', async () => {
    await driver.open();

    driver.clickInPane('.pick-date');

    driver.field().focus();
    driver.blurField();

    expect(driver.control.parseError()).toBe(false);
    expect(driver.control.displayValue()).toBe('07/16/2026, __:__');
  });

  it('drops a held half once the field is typed into', async () => {
    await driver.open();

    driver.clickInPane('.pick-date');

    driver.typeAndBlur('12/24/2026, 08:00');

    expect(driver.host.value()).toBe('2026-12-24 08:00');

    driver.clickInPane('.pick-time');

    // the typed day won, so the time lands on it rather than completing the dropped half
    expect(driver.host.value()).toBe('2026-12-24 21:45');
  });

  it('clears a held half with the value', async () => {
    await driver.open();

    driver.clickInPane('.pick-date');

    driver.control.clearValue();
    tick();

    expect(driver.control.displayValue()).toBe('');
    expect(driver.control.hasValue()).toBe(false);
  });

  it('closes the picker on an outside pointerdown', async () => {
    await driver.open();

    driver.pointerDownOutside();
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(false);
  });

  it('opens the picker with Alt+ArrowDown from the field', async () => {
    driver.field().focus();
    pressKey(driver.field(), 'ArrowDown', { altKey: true });
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', async () => {
    driver.host.disabled.set(true);
    tick();

    expect(driver.trigger<HTMLButtonElement>().disabled).toBe(true);

    driver.control.openPicker();
    tick();

    expect(driver.control.pickerOpen()).toBe(false);
  });

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      driver.host.value.set('2026-03-05 08:15');
      driver.host.mixed.set(true);
      tick();
    };

    it('renders the field empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(driver.field().value).toBe('');
      expect(driver.field().getAttribute('placeholder')).toBe('Mixed');
      expect(driver.control.displayValue()).toBe('');
      expect(driver.control.dateTime()).toBeNull();
      expect(driver.control.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw value on a failed typed parse', () => {
      enterMixed();
      driver.typeAndBlur('not a date');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('2026-03-05 08:15');
      expect(driver.control.parseError()).toBe(true);
    });

    it('keeps mixed and the raw value on a blank blur commit', () => {
      enterMixed();
      driver.typeAndBlur('');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('2026-03-05 08:15');
    });

    it('replaces on a picked day: the hidden value goes, the day is held', async () => {
      enterMixed();
      await driver.open();

      expect(driver.host.mixed()).toBe(true);

      driver.clickInPane('.pick-date');

      expect(driver.host.mixed()).toBe(false);
      // the hidden 08:15 must not leak into the fresh pick - replace semantics
      expect(driver.host.value()).toBeNull();
      expect(driver.control.displayValue()).toBe('07/16/2026, __:__');
      expect(driver.control.pickerOpen()).toBe(true);

      driver.clickInPane('.pick-time');

      expect(driver.host.value()).toBe('2026-07-16 21:45');
    });

    it('replaces on a picked time: the hidden value goes, the time is held', async () => {
      enterMixed();
      await driver.open();

      driver.clickInPane('.pick-time');

      expect(driver.host.mixed()).toBe(false);
      // the hidden 2026-03-05 must not leak into the fresh pick - replace semantics
      expect(driver.host.value()).toBeNull();
      expect(driver.control.displayValue()).toBe('__/__/____, 21:45');
    });
  });
});

describe('DateTimeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    const driver = mountDatePicker(DateTimeInputTestHost, DateTimeInputDirective);

    return {
      enterMixed: () => {
        driver.host.value.set('2026-03-05 08:15');
        driver.host.mixed.set(true);
        tick();
      },
      rawValue: () => '2026-03-05 08:15',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set('2026-01-01 12:00');
        tick();
      },
      externallyWrittenValue: () => '2026-01-01 12:00',
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        tick();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.field().placeholder,
      commit: () => driver.typeAndBlur('07/20/2026, 14:30'),
      committedValue: () => '2026-07-20 14:30',
      assertMasked: () => {
        expect(driver.control.dateTime()).toBeNull();
        expect(driver.control.displayValue()).toBe('');
        expect(driver.field().value).toBe('');
        expect(driver.field().getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        driver.control.clearValue();
        tick();
      },
      emptyValue: () => null,
    };
  });
});

@Component({
  template: `
    <div
      [(value)]="value"
      [timeZone]="timeZone()"
      displayFormat="MM/dd/yyyy, HH:mm"
      etDateTimeInput
      valueFormat="yyyy-MM-dd'T'HH:mm:ssxxx"
    >
      <input etDateTimeInputField />
    </div>
  `,
  imports: [DateTimeInputDirective, DateTimeInputFieldDirective],
})
class ZonedDateTimeInputTestHost {
  value = signal<string | null>(null);
  timeZone = signal<string | null>(null);
}

/** 2026-08-18T14:00 in Tokyo, 2026-08-18T01:00 in New York. */
const RUNTIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const FIELD =
  RUNTIME_ZONE === 'Asia/Tokyo'
    ? {
        zone: 'America/New_York',
        name: 'New York',
        wire: '2026-08-18T01:00:00-04:00',
        display: '08/18/2026, 01:00',
        afterDayPick: '2026-07-16T01:00:00-04:00',
        afterTimePick: '2026-08-18T21:45:00-04:00',
      }
    : {
        zone: 'Asia/Tokyo',
        name: 'Tokyo',
        wire: '2026-08-18T14:00:00+09:00',
        display: '08/18/2026, 14:00',
        afterDayPick: '2026-07-16T14:00:00+09:00',
        afterTimePick: '2026-08-18T21:45:00+09:00',
      };

describe('DateTimeInputDirective time zone', () => {
  let fixture: ComponentFixture<ZonedDateTimeInputTestHost>;
  let host: ZonedDateTimeInputTestHost;
  let input: DateTimeInputDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ZonedDateTimeInputTestHost] });
    fixture = TestBed.createComponent(ZonedDateTimeInputTestHost);
    host = fixture.componentInstance;
    host.timeZone.set(FIELD.zone);
    fixture.detectChanges();
    input = fixture.debugElement.query(By.directive(DateTimeInputDirective)).injector.get(DateTimeInputDirective);
  });

  const setValue = (value: string) => {
    host.value.set(value);
    fixture.detectChanges();
  };

  const setTimeZone = (timeZone: string) => {
    host.timeZone.set(timeZone);
    fixture.detectChanges();
  };

  it('renders the field in the given zone', () => {
    setValue(FIELD.wire);

    expect(input.displayValue()).toBe(FIELD.display);
  });

  it('names the zone by the last segment of its IANA name', () => {
    expect(input.resolvedTimeZoneLabel()).toBe(FIELD.name);
  });

  it('reads typed text as that zone and writes the zone offset', () => {
    input.commitInput(FIELD.display);

    expect(host.value()).toBe(FIELD.wire);
  });

  it('keeps the zone time of day when a day is picked', () => {
    setValue(FIELD.wire);
    input.selectDate(new Date(2026, 6, 16));

    expect(host.value()).toBe(FIELD.afterDayPick);
  });

  it('keeps the zone day when a time is picked', () => {
    setValue(FIELD.wire);
    input.selectTime(new Date(2026, 0, 1, 21, 45));

    expect(host.value()).toBe(FIELD.afterTimePick);
  });

  it('offers a second reading in the runtime zone', () => {
    setValue(FIELD.wire);

    expect(input.localReading()).not.toBeNull();
    expect(input.localReading()).not.toBe(FIELD.display);
  });

  it('offers no second reading while the field zone is the runtime zone', () => {
    setTimeZone(RUNTIME_ZONE);
    setValue(FIELD.wire);

    expect(input.localReading()).toBeNull();
  });

  it('offers no second reading while the field is empty', () => {
    expect(input.localReading()).toBeNull();
    expect(input.localReadingId()).toBeNull();
  });

  it('ignores a zone name Intl does not know', () => {
    setTimeZone('Middle/Earth');
    setValue(FIELD.wire);

    expect(input.effectiveTimeZone()).toBeNull();
    expect(input.localReading()).toBeNull();
  });

  it('describes the field by the second reading only while it renders', () => {
    expect(input.describedByIds()).toBeNull();

    setValue(FIELD.wire);

    expect(input.describedByIds()).toBe(input.localReadingId());
  });
});

describe('DateTimeInputDirective commit contract', () => {
  describePickerCommitContract(() => {
    const driver = mountDatePicker(DateTimeInputTestHost, DateTimeInputDirective);

    return {
      commitValue: () => driver.typeAndBlur('07/20/2026, 14:30'),
      committedValue: () => '2026-07-20 14:30',
      emptyValue: () => null,
      value: () => driver.host.value(),
      parseError: () => driver.control.parseError(),
      focus: () => driver.focusField(),
      blur: () => driver.blurField(),
      typeAndBlur: (text: string) => driver.typeAndBlur(text),
      makeReadonly: () => {
        driver.host.readonly.set(true);
        tick();
      },
    };
  });
});
