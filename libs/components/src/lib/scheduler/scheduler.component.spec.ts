import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../test-helpers';
import { injectOverlayManager } from '../overlay';
import { TEST_COLOR_THEMES } from '../testing/color-themes';
import { SchedulerComponent } from './scheduler.component';
import { Appointment } from './scheduler.types';

const appointment = (id: string): Appointment => ({
  id,
  parentId: null,
  title: id,
  start: new Date(2026, 6, 15, 9),
  end: new Date(2026, 6, 15, 10),
});

@Component({
  template: `<et-scheduler [(selectedAppointmentId)]="selectedId" [appointments]="appointments()" />`,
  imports: [SchedulerComponent],
})
class SchedulerTestHostComponent {
  appointments = signal<Appointment[]>([appointment('a'), appointment('b')]);
  selectedId = signal<string | null>(null);
}

describe('SchedulerComponent', () => {
  let fixture: ComponentFixture<SchedulerTestHostComponent>;
  let host: SchedulerTestHostComponent;
  let scheduler: SchedulerComponent;

  const openSurfaces = () => document.querySelectorAll('et-scheduler-edit-surface').length;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SchedulerTestHostComponent],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(SchedulerTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    scheduler = fixture.debugElement.children[0].componentInstance;
  });

  afterEach(() => {
    for (const overlay of TestBed.runInInjectionContext(() => injectOverlayManager()).openOverlays()) {
      overlay.close();
    }

    fixture.destroy();
  });

  it('opens the edit surface once for a selected appointment', () => {
    host.selectedId.set('a');
    fixture.detectChanges();

    expect(openSurfaces()).toBe(1);
  });

  it('does not stack a second surface when appointments is replaced with new object identities', () => {
    host.selectedId.set('a');
    fixture.detectChanges();

    host.appointments.set([appointment('a'), appointment('b')]);
    fixture.detectChanges();

    expect(openSurfaces()).toBe(1);
  });

  it('selects an appointment without opening the edit surface', () => {
    scheduler.selectAppointment('a');
    fixture.detectChanges();

    expect(host.selectedId()).toBe('a');
    expect(openSurfaces()).toBe(0);
  });

  it('opens the edit surface for an appointment selected without one', () => {
    scheduler.selectAppointment('a');
    fixture.detectChanges();

    scheduler.openEditSurface('a');
    fixture.detectChanges();

    expect(openSurfaces()).toBe(1);
  });

  it('ignores an open request for an appointment it does not know', () => {
    scheduler.openEditSurface('nope');
    fixture.detectChanges();

    expect(host.selectedId()).toBeNull();
    expect(openSurfaces()).toBe(0);
  });
});
