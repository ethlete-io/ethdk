import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { TimePickerColumnDirective } from './time-picker-column.directive';
import { TimePickerOptionDirective } from './time-picker-option.directive';
import { TimePickerDirective } from './time-picker.directive';

@Component({
  template: `
    <div #picker="etTimePicker" [(value)]="value" [format]="format()" [minuteStep]="minuteStep()" etTimePicker>
      @for (column of picker.columns(); track column.unit) {
        <div [column]="column" [attr.data-unit]="column.unit" etTimePickerColumn>
          @for (option of column.options; track option.value) {
            <button [option]="option" [attr.data-value]="option.value" etTimePickerOption>{{ option.label }}</button>
          }
        </div>
      }
    </div>
  `,
  imports: [TimePickerDirective, TimePickerColumnDirective, TimePickerOptionDirective],
})
class TimePickerTestHost {
  value = signal<Date | null>(null);
  format = signal('HH:mm');
  minuteStep = signal(5);
}

describe('TimePickerDirective', () => {
  let fixture: ComponentFixture<TimePickerTestHost>;
  let host: TimePickerTestHost;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const column = (unit: string) => fixture.nativeElement.querySelector<HTMLElement>(`[data-unit='${unit}']`);
  const columns = () => Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('[data-unit]'));
  const optionButton = (unit: string, value: number) =>
    column(unit)?.querySelector<HTMLButtonElement>(`[data-value='${value}']`) ?? null;
  const selectedIn = (unit: string) => column(unit)?.querySelector<HTMLButtonElement>('[data-selected]') ?? null;

  const keydown = (unit: string, key: string) =>
    column(unit)?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TimePickerTestHost] });
    fixture = TestBed.createComponent(TimePickerTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders hour and minute columns for a 24-hour format without seconds', () => {
    expect(columns().map((columnElement) => columnElement.dataset['unit'])).toEqual(['hour', 'minute']);
    expect(column('hour')?.querySelectorAll('button').length).toBe(24);
    expect(column('minute')?.querySelectorAll('button').length).toBe(12);
    expect(column('hour')?.getAttribute('role')).toBe('listbox');
    expect(column('hour')?.getAttribute('aria-label')).toBe('Hours');
  });

  it('adds seconds and period columns per format', () => {
    host.format.set('h:mm:ss a');
    tick();

    expect(columns().map((columnElement) => columnElement.dataset['unit'])).toEqual([
      'hour',
      'minute',
      'second',
      'period',
    ]);
    expect(column('hour')?.querySelectorAll('button').length).toBe(12);
    expect(optionButton('hour', 0)?.textContent?.trim()).toBe('12');
  });

  it('completes the anchor time on the first pick and updates parts on later picks', () => {
    optionButton('minute', 30)?.click();
    tick();

    expect(host.value()).not.toBeNull();
    expect(host.value()?.getMinutes()).toBe(30);

    optionButton('hour', 9)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(9);
    expect(host.value()?.getMinutes()).toBe(30);
    expect(selectedIn('hour')?.dataset['value']).toBe('9');
    expect(selectedIn('hour')?.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps an off-step selection visible in its column', async () => {
    host.value.set(new Date(2026, 6, 17, 9, 32));
    tick();
    await fixture.whenStable();

    expect(selectedIn('minute')?.textContent?.trim()).toBe('32');

    const values = Array.from(column('minute')?.querySelectorAll<HTMLElement>('button') ?? []).map(
      (button) => button.dataset['value'],
    );

    expect(values).toContain('32');
    expect(values.indexOf('32')).toBe(values.indexOf('30') + 1);
  });

  it('maps 12-hour picks through the period', async () => {
    host.format.set('h:mm a');
    host.value.set(new Date(2026, 6, 17, 14, 0));
    tick();
    await fixture.whenStable();

    expect(selectedIn('hour')?.textContent?.trim()).toBe('2');
    expect(selectedIn('period')?.dataset['value']).toBe('1');

    optionButton('hour', 9)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(21);

    optionButton('period', 0)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(9);
  });

  it('moves the selection with arrows, wrapping at the edges', async () => {
    host.value.set(new Date(2026, 6, 17, 23, 0));
    tick();
    await fixture.whenStable();

    keydown('hour', 'ArrowDown');
    tick();

    expect(host.value()?.getHours()).toBe(0);

    keydown('hour', 'ArrowUp');
    tick();

    expect(host.value()?.getHours()).toBe(23);

    keydown('minute', 'End');
    tick();

    expect(host.value()?.getMinutes()).toBe(55);

    keydown('minute', 'Home');
    tick();

    expect(host.value()?.getMinutes()).toBe(0);
  });

  it('jumps to a typed option', async () => {
    host.value.set(new Date(2026, 6, 17, 8, 0));
    tick();
    await fixture.whenStable();

    keydown('hour', '1');
    keydown('hour', '7');
    tick();

    expect(host.value()?.getHours()).toBe(17);
  });

  it('roves the tabindex with the selection', async () => {
    host.value.set(new Date(2026, 6, 17, 9, 15));
    tick();
    await fixture.whenStable();

    expect(optionButton('hour', 9)?.tabIndex).toBe(0);
    expect(optionButton('hour', 10)?.tabIndex).toBe(-1);

    optionButton('hour', 10)?.click();
    tick();

    expect(optionButton('hour', 9)?.tabIndex).toBe(-1);
    expect(optionButton('hour', 10)?.tabIndex).toBe(0);
  });
});
