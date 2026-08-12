import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';
import { DateTimeRangeInputComponent } from './date-time-range-input.component';
import { DateTimeRangeInputDirective, DateTimeRangeValue } from './headless';

@Component({
  template: `
    <et-date-time-range-input
      [(value)]="value"
      [startAt]="startAt"
      aria-label="Stay"
      displayFormat="MM/dd/yyyy, HH:mm"
    />
  `,
  imports: [DateTimeRangeInputComponent],
})
class DateTimeRangeInputHost {
  value = signal<DateTimeRangeValue>({ start: null, end: null });
  startAt = new Date(2026, 6, 1);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('DateTimeRangeInputComponent - picker panes', () => {
  let fixture: ComponentFixture<DateTimeRangeInputHost>;
  let rangeInput: DateTimeRangeInputDirective;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const panes = () => pane()?.querySelector<HTMLElement>('.et-date-time-range-input-panel-panes') ?? null;
  const activePane = () => panes()?.dataset['activePane'] ?? null;

  const dayCell = (label: string) =>
    Array.from(pane()?.querySelectorAll<HTMLButtonElement>('.et-calendar-cell') ?? []).find(
      (cell) => cell.textContent?.trim() === label && !cell.hasAttribute('data-outside-month'),
    ) ?? null;

  const tab = (label: string) =>
    Array.from(pane()?.querySelectorAll<HTMLElement>('et-segmented-button') ?? []).find(
      (button) => button.textContent?.trim() === label,
    ) ?? null;

  const openPicker = async () => {
    fixture.nativeElement.querySelector<HTMLButtonElement>('.et-input-picker-trigger')?.click();
    tick();
    await flushFrames();
    tick();
  };

  const closePicker = () => {
    rangeInput.closePicker();
    tick();
    // jsdom fires no transition events, so the leaving pane would linger and shadow the next open
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [DateTimeRangeInputHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(DateTimeRangeInputHost);
    fixture.detectChanges();
    rangeInput = fixture.debugElement.children[0]!.injector.get(DateTimeRangeInputDirective);
  });

  afterEach(async () => {
    closePicker();
    await flushFrames();
  });

  it('holds the dates pane until both days are picked, then carries on to the times', async () => {
    await openPicker();

    expect(activePane()).toBe('dates');

    dayCell('16')?.click();
    tick();

    // one day is not a range yet - the second is still to come on this pane
    expect(activePane()).toBe('dates');

    dayCell('18')?.click();
    tick();

    expect(activePane()).toBe('times');
  });

  it('advances once only, so going back to correct the days is not interrupted', async () => {
    await openPicker();
    dayCell('16')?.click();
    tick();
    dayCell('18')?.click();
    tick();

    tab('Dates')?.click();
    tick();

    expect(activePane()).toBe('dates');

    dayCell('20')?.click();
    tick();
    dayCell('22')?.click();
    tick();

    expect(activePane()).toBe('dates');
  });
});
