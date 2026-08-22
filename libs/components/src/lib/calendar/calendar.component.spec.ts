import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { expectAriaGrid, expectUniformCellsPerRow, resolveAriaOwner } from '../testing/aria-structure';
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

describe('CalendarComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const query = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  const queryAll = (selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders its own header by default', () => {
    expect(query('.et-calendar-header')).not.toBeNull();
    expect(query('.et-calendar-header-label')?.textContent?.trim()).toContain('July 2026');
    expect(query('.own-label')).toBeNull();
  });

  it('lets a projected template replace the header and drive the calendar', () => {
    host.customHeader.set(true);
    fixture.detectChanges();

    expect(query('.et-calendar-header')).toBeNull();
    expect(query('.own-label')?.textContent?.trim()).toBe('July 2026');
    // the grid is untouched by the swap
    expect(queryAll('[etcalendarcell]').length).toBe(35);

    query('.own-previous')?.click();
    fixture.detectChanges();

    expect(query('.own-label')?.textContent?.trim()).toBe('June 2026');

    query('.own-zoom')?.click();
    fixture.detectChanges();

    expect(query('.own-label')?.textContent?.trim()).toBe('2026');
    expect(queryAll('[etcalendarcell]').length).toBe(12);
  });

  it('renders the week-number column only when asked', () => {
    expect(queryAll('.et-calendar-week-number')).toHaveLength(0);

    host.weekNumbers.set(true);
    fixture.detectChanges();

    const numbers = queryAll('.et-calendar-week-number');

    expect(numbers).toHaveLength(5);
    expect(numbers[0]?.getAttribute('role')).toBe('rowheader');
    expect(numbers[0]?.textContent?.trim()).toBe('27');
    expect(query('.et-calendar')?.hasAttribute('data-week-numbers')).toBe(true);
  });

  it('exposes a grid that owns its row groups, in every view', () => {
    const grid = () => query('[role="grid"]')!;

    expectAriaGrid(grid());
    expectUniformCellsPerRow(grid());
    expect(resolveAriaOwner(query('.et-calendar-weeks')!)).toBe(grid());
    expect(queryAll('[role="rowgroup"] [role="rowgroup"]')).toHaveLength(0);

    query('.et-calendar-header-label')?.click();
    fixture.detectChanges();

    expectAriaGrid(grid());
    expectUniformCellsPerRow(grid());

    query('.et-calendar-header-label')?.click();
    fixture.detectChanges();

    expectAriaGrid(grid());
    expectUniformCellsPerRow(grid());
  });

  it('keeps the grid structure with week numbers on', () => {
    host.weekNumbers.set(true);
    fixture.detectChanges();

    expectAriaGrid(query('[role="grid"]')!);
    expectUniformCellsPerRow(query('[role="grid"]')!);
  });

  it('exposes the headless directive for chrome of the consumer’s own', () => {
    const calendar = fixture.debugElement.children[0]!.componentInstance as CalendarComponent;

    expect(calendar.headless.headerLabel()).toBe('July 2026');

    calendar.headless.next();
    fixture.detectChanges();

    expect(query('.et-calendar-header-label')?.textContent?.trim()).toContain('August 2026');
  });
});
