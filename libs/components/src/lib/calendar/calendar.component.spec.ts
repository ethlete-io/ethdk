import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { expectAriaGrid, expectUniformCellsPerRow, resolveAriaOwner } from '../testing/aria-structure';
import { query, queryAll } from '../testing/driver-core';
import { CalendarHeaderDirective } from './calendar-header.directive';
import { CalendarComponent } from './calendar.component';

@Component({
  template: `
    <et-calendar [(value)]="value" [activeMonth]="activeMonth()" [weekNumbers]="weekNumbers()">
      @if (customHeader()) {
        <ng-template etCalendarHeader let-calendar>
          <button (click)="calendar.previous()" class="own-previous" type="button">back</button>
          <span class="own-label">{{ calendar.headerLabel() }}</span>
          <button (click)="calendar.zoomOut()" class="own-zoom" type="button">zoom</button>
        </ng-template>
      }
    </et-calendar>
  `,
  imports: [CalendarComponent, CalendarHeaderDirective],
})
class HostComponent {
  value = signal<Date | null>(null);
  activeMonth = signal<Date | null>(new Date(2026, 6, 1));
  customHeader = signal(false);
  weekNumbers = signal(false);
}

@Component({
  template: ` <et-calendar weekNumbers /> <et-calendar weekNumbers /> `,
  imports: [CalendarComponent],
})
class TwoCalendarsHostComponent {}

describe('CalendarComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders its own header by default', () => {
    expect(query(fixture, '.et-calendar-header')).not.toBeNull();
    expect(query(fixture, '.et-calendar-header-label')?.textContent?.trim()).toContain('July 2026');
    expect(query(fixture, '.own-label')).toBeNull();
  });

  it('lets a projected template replace the header and drive the calendar', () => {
    host.customHeader.set(true);
    fixture.detectChanges();

    expect(query(fixture, '.et-calendar-header')).toBeNull();
    expect(query(fixture, '.own-label')?.textContent?.trim()).toBe('July 2026');
    // the grid is untouched by the swap
    expect(queryAll(fixture, '[etcalendarcell]').length).toBe(35);

    query(fixture, '.own-previous')?.click();
    fixture.detectChanges();

    expect(query(fixture, '.own-label')?.textContent?.trim()).toBe('June 2026');

    query(fixture, '.own-zoom')?.click();
    fixture.detectChanges();

    expect(query(fixture, '.own-label')?.textContent?.trim()).toBe('2026');
    expect(queryAll(fixture, '[etcalendarcell]').length).toBe(12);
  });

  it('renders the week-number column only when asked', () => {
    expect(queryAll(fixture, '.et-calendar-week-number')).toHaveLength(0);

    host.weekNumbers.set(true);
    fixture.detectChanges();

    const numbers = queryAll(fixture, '.et-calendar-week-number');

    expect(numbers).toHaveLength(5);
    expect(numbers[0]?.getAttribute('role')).toBe('rowheader');
    expect(numbers[0]?.textContent?.trim()).toBe('27');
    expect(query(fixture, '.et-calendar')?.hasAttribute('data-week-numbers')).toBe(true);
  });

  it('exposes a grid that owns its row groups, in every view', () => {
    const grid = () => query(fixture, '[role="grid"]')!;

    expectAriaGrid(grid());
    expectUniformCellsPerRow(grid());
    expect(resolveAriaOwner(query(fixture, '.et-calendar-weeks')!)).toBe(grid());
    expect(queryAll(fixture, '[role="rowgroup"] [role="rowgroup"]')).toHaveLength(0);

    query(fixture, '.et-calendar-header-label')?.click();
    fixture.detectChanges();

    expectAriaGrid(grid());
    expectUniformCellsPerRow(grid());

    query(fixture, '.et-calendar-header-label')?.click();
    fixture.detectChanges();

    expectAriaGrid(grid());
    expectUniformCellsPerRow(grid());
  });

  it('keeps the grid structure with week numbers on', () => {
    host.weekNumbers.set(true);
    fixture.detectChanges();

    expectAriaGrid(query(fixture, '[role="grid"]')!);
    expectUniformCellsPerRow(query(fixture, '[role="grid"]')!);
  });

  it('mounts an on-demand stylesheet once, no matter how many calendars use it', () => {
    const twoFixture = TestBed.createComponent(TwoCalendarsHostComponent);
    twoFixture.detectChanges();

    expect(document.querySelectorAll('et-calendar-week-numbers-styles')).toHaveLength(1);
  });

  it('exposes the headless directive for chrome of the consumer’s own', () => {
    const calendar = fixture.debugElement.children[0]!.componentInstance as CalendarComponent;

    expect(calendar.headless.headerLabel()).toBe('July 2026');

    calendar.headless.next();
    fixture.detectChanges();

    expect(query(fixture, '.et-calendar-header-label')?.textContent?.trim()).toContain('August 2026');
  });
});
