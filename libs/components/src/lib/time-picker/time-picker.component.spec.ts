import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TimeRange } from './headless';
import { TimePickerComponent } from './time-picker.component';

@Component({
  template: `<et-time-picker [(rangeValue)]="rangeValue" [format]="format()" mode="range" />`,
  imports: [TimePickerComponent],
})
class TimePickerRangeHost {
  rangeValue = signal<TimeRange>({ start: new Date(2026, 6, 8, 9, 0), end: null });
  format = signal('HH:mm');
}

describe('TimePickerComponent - side switch', () => {
  const setup = () => {
    TestBed.configureTestingModule({ imports: [TimePickerRangeHost] });

    const fixture = TestBed.createComponent(TimePickerRangeHost);

    fixture.detectChanges();

    const chips = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.et-time-picker-side'));
    const textOf = (chip: HTMLElement, part: 'label' | 'value') =>
      chip.querySelector(`.et-time-picker-side-${part}`)?.textContent?.trim();

    return {
      fixture,
      host: fixture.componentInstance,
      chips,
      textOf,
      tick: () => TestBed.inject(ApplicationRef).tick(),
    };
  };

  it('names both ends and shows their times, the unset one as a dash', () => {
    const { chips, textOf } = setup();

    expect(chips().map((chip) => chip.dataset['side'])).toEqual(['start', 'end']);
    expect(chips().map((chip) => textOf(chip, 'label'))).toEqual(['Start time', 'End time']);
    expect(chips().map((chip) => textOf(chip, 'value'))).toEqual(['09:00', '—']);
  });

  it('renders the two ends as a bare time even when the columns derive from a combined format', () => {
    const { chips, textOf, host, tick } = setup();

    host.format.set('dd.MM.yyyy HH:mm');
    tick();

    expect(textOf(chips()[0]!, 'value')).toBe('09:00');
  });

  it('marks the end being edited, and switches on click', () => {
    const { chips, tick } = setup();

    expect(chips().map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    chips()[1]!.click();
    tick();

    expect(chips().map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('renders no side switch in single mode', () => {
    TestBed.configureTestingModule({ imports: [TimePickerComponent] });

    const fixture = TestBed.createComponent(TimePickerComponent);

    fixture.detectChanges();

    const hostElement = fixture.nativeElement as HTMLElement;

    expect(hostElement.querySelector('.et-time-picker-sides')).toBeNull();
    expect(hostElement.querySelectorAll('.et-time-picker-column').length).toBe(2);
  });
});
