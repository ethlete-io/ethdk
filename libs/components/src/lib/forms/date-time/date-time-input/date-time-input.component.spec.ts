import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';
import { DateTimeInputComponent } from './date-time-input.component';
import { DateTimeInputDirective } from './headless';

@Component({
  template: `
    <et-date-time-input
      [(value)]="value"
      [startAt]="startAt"
      aria-label="Appointment"
      displayFormat="MM/dd/yyyy, HH:mm"
    />
  `,
  imports: [DateTimeInputComponent],
})
class DateTimeInputHost {
  value = signal<string | null>(null);
  startAt = new Date(2026, 6, 1);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('DateTimeInputComponent - picker panes', () => {
  let fixture: ComponentFixture<DateTimeInputHost>;
  let dateTimeInput: DateTimeInputDirective;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const panes = () => pane()?.querySelector<HTMLElement>('.et-date-time-input-panel-panes') ?? null;
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
    dateTimeInput.closePicker();
    tick();
    // jsdom fires no transition events, so the leaving pane would linger and shadow the next open
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [DateTimeInputHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(DateTimeInputHost);
    fixture.detectChanges();
    dateTimeInput = fixture.debugElement.children[0]!.injector.get(DateTimeInputDirective);
  });

  afterEach(async () => {
    closePicker();
    await flushFrames();
  });

  it('opens on the date pane and carries the first day pick on to the time pane', async () => {
    await openPicker();

    expect(activePane()).toBe('date');

    dayCell('16')?.click();
    tick();

    expect(activePane()).toBe('time');
  });

  it('advances once only, so going back to correct the day is not interrupted', async () => {
    await openPicker();

    dayCell('16')?.click();
    tick();

    expect(activePane()).toBe('time');

    tab('Date')?.click();
    tick();

    expect(activePane()).toBe('date');

    dayCell('17')?.click();
    tick();

    expect(activePane()).toBe('date');
  });

  it('starts a fresh open back on the date pane, ready to advance again', async () => {
    await openPicker();
    dayCell('16')?.click();
    tick();

    expect(activePane()).toBe('time');

    closePicker();
    await flushFrames();
    await openPicker();

    expect(activePane()).toBe('date');

    dayCell('17')?.click();
    tick();

    expect(activePane()).toBe('time');
  });
});
