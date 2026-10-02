import { Component, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  Appointment,
  AppointmentId,
  DEFAULT_SCHEDULER_LABELS,
  injectSchedulerLabels,
  provideOverlay,
  provideSchedulerEditSurface,
  provideSchedulerLabels,
  SCHEDULER_ERROR_CODES,
  SCHEDULER_IMPORTS,
  SCHEDULER_LABELS,
  SchedulerAppointmentDragDirective,
  SchedulerBadgeTitleDirective,
  SchedulerEditTitleDirective,
  SchedulerMonthViewComponent,
  SchedulerSwipeNavigationDirective,
  SchedulerAppointmentReschedule,
  SchedulerBusinessHours,
  SchedulerComponent,
  SchedulerView,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const SCHEDULER_COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const at = (day: number, hour: number, minute = 0) => new Date(2026, 6, day, hour, minute);

const appointment = (id: AppointmentId, overrides: Partial<Appointment> = {}): Appointment => ({
  id,
  parentId: null,
  title: id,
  start: at(15, 9),
  end: at(15, 10),
  ...overrides,
});

const APPOINTMENTS: Appointment[] = [
  appointment('kickoff', { title: 'Kickoff', location: 'Room 1', colorToken: 'primary' }),
  appointment('prep', { parentId: 'kickoff', title: 'Kickoff prep', start: at(15, 11), end: at(15, 12) }),
  appointment('slides', { parentId: 'prep', title: 'Slides', start: at(15, 13), end: at(15, 14) }),
  appointment('offsite', { title: 'Offsite', start: at(20, 0), end: at(21, 23, 59), allDay: true }),
  appointment('one', { title: 'One', start: at(22, 8), end: at(22, 9) }),
  appointment('two', { title: 'Two', start: at(22, 9), end: at(22, 10) }),
  appointment('three', { title: 'Three', start: at(22, 10), end: at(22, 11) }),
  appointment('four', { title: 'Four', start: at(22, 11), end: at(22, 12) }),
];

// jsdom loads no component stylesheets, so the dimension observers would see inline hosts.
const UNSTYLED_BLOCKS = 'et-scheduler, et-overlay-body { display: block; }';

@Component({
  selector: 'et-scenario-planner',
  imports: [SCHEDULER_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <et-scheduler
      #scheduler
      [(view)]="view"
      [(focusedDate)]="focusedDate"
      [(selectedAppointmentId)]="selectedId"
      [appointments]="appointments()"
      [firstDayOfWeek]="1"
      [businessHours]="businessHours()"
      [nowIndicator]="nowIndicator()"
      [agendaDays]="agendaDays()"
      [etSchedulerBadgeLocation]="{ enabled: showLocation() }"
      [etSchedulerActionAddAppointment]="{ enabled: canAdd() }"
      [etSchedulerAppointmentDrag]="{ enabled: canDrag() }"
      (appointmentSave)="saved.set($event)"
      (appointmentsDelete)="deleted.set($event)"
      (appointmentReschedule)="rescheduled.set($event)"
    />
  `,
})
class PlannerComponent {
  view = signal<SchedulerView>('month');
  focusedDate = signal(at(15, 0));
  selectedId = signal<AppointmentId | null>(null);
  appointments = signal<readonly Appointment[]>(APPOINTMENTS);
  businessHours = signal<readonly SchedulerBusinessHours[] | null>(null);
  nowIndicator = signal(true);
  agendaDays = signal<number | null>(null);
  showLocation = signal(true);
  canAdd = signal(true);
  canDrag = signal(true);
  saved = signal<Appointment | null>(null);
  deleted = signal<readonly AppointmentId[] | null>(null);
  rescheduled = signal<SchedulerAppointmentReschedule | null>(null);
  scheduler = viewChild.required(SchedulerComponent);
}

@Component({
  selector: 'et-scenario-stray-badge',
  imports: [SchedulerBadgeTitleDirective],
  template: `<div etSchedulerBadgeTitle></div>`,
})
class StrayBadgeComponent {}

@Component({
  selector: 'et-scenario-stray-field',
  imports: [SchedulerEditTitleDirective],
  template: `<div etSchedulerEditTitle></div>`,
})
class StrayFieldComponent {}

@Component({
  selector: 'et-scenario-stray-swipe',
  imports: [SchedulerSwipeNavigationDirective],
  template: `<div etSchedulerSwipeNavigation></div>`,
})
class StraySwipeComponent {}

@Component({
  selector: 'et-scenario-stray-drag',
  imports: [SchedulerAppointmentDragDirective],
  template: `<div etSchedulerAppointmentDrag></div>`,
})
class StrayDragComponent {}

@Component({
  selector: 'et-scenario-stray-view',
  imports: [SchedulerMonthViewComponent],
  template: `<et-scheduler-month-view />`,
})
class StrayViewComponent {}

const code = (value: number) => `ET${value}`;

const dropElementPayloads = (s: Scenario) =>
  s.errors.splice(
    0,
    s.errors.length,
    ...s.errors.filter((entry) => !(entry.source === 'console.error' && typeof entry.error === 'object')),
  );

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const texts = (selector: string, root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLElement>(selector)].map((element) => (element.textContent ?? '').trim());

const monthCell = (host: HTMLElement, day: number) => {
  const cell = [...host.querySelectorAll<HTMLElement>('.et-scheduler-month-view-cell')].find(
    (candidate) =>
      !candidate.hasAttribute('data-outside-month') &&
      candidate.querySelector('.et-scheduler-month-view-cell-date')?.textContent?.trim() === String(day),
  );

  if (!cell) throw new Error(`no month cell for ${day}`);

  return cell;
};

const type = (s: Scenario, field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

const surface = () => document.querySelector<HTMLElement>('et-scheduler-edit-surface');

const button = (label: string, root: ParentNode = document) => {
  const match = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => (candidate.textContent ?? '').trim() === label || candidate.getAttribute('aria-label') === label,
  );

  if (!match) throw new Error(`no button ${label}`);

  return match;
};

const switchView = (s: Scenario, label: string, root: ParentNode) => {
  const option = [...root.querySelectorAll<HTMLElement>('et-segmented-button')].find(
    (candidate) => (candidate.textContent ?? '').trim() === label,
  );

  if (!option) throw new Error(`no view option ${label}`);

  option.click();
  s.tick();
};

const finish = (s: Scenario) => {
  if (surface()) {
    button('Cancel', surface()!).click();
    s.tick(1000);
  }

  s.flush();
};

describe('scheduler scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemesWithTailwind4(SCHEDULER_COLOR_THEMES),
      provideSchedulerEditSurface(),
    ],
  });

  beforeEach(() => vi.setSystemTime(at(15, 8, 30)));

  it('renders appointments into the month grid with every default badge and a +N more overflow', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(query('.et-scheduler-header-label', host).textContent?.trim()).toBe('July 2026');
    expect(texts('.et-scheduler-month-view-weekday', host)[0]).toBe('Mo');
    expect(host.querySelectorAll('.et-scheduler-month-view-week')).toHaveLength(5);

    const today = monthCell(host, 15);

    expect(today.getAttribute('aria-current')).toBe('date');
    expect(texts('.et-scheduler-appointment-title', today)).toEqual(['Kickoff', 'Kickoff prep', 'Slides']);

    const kickoff = query('.et-scheduler-appointment[title="Kickoff"]', today);

    expect(query('.et-scheduler-appointment-dot', kickoff)).toBeTruthy();
    expect(query('.et-scheduler-appointment-time-range', kickoff).textContent?.trim()).toBe('9:00 AM–10:00 AM');
    expect(query('.et-scheduler-appointment-location-text', kickoff).textContent?.trim()).toBe('Room 1');
    expect(query('.et-scheduler-appointment-chain-count', kickoff).textContent?.trim()).toBe('2');
    expect(kickoff.hasAttribute('data-draggable')).toBe(true);

    expect(texts('.et-scheduler-appointment-title', monthCell(host, 21))).toEqual(['Offsite']);
    expect(monthCell(host, 21).querySelector('.et-scheduler-appointment-time-range')).toBeNull();

    const busy = monthCell(host, 22);

    expect(texts('.et-scheduler-appointment-title', busy)).toEqual(['One', 'Two', 'Three']);
    expect(query('.et-scheduler-month-view-overflow-trigger', busy).textContent?.trim()).toBe('+1 more');

    fixture.componentInstance.showLocation.set(false);
    fixture.componentInstance.canDrag.set(false);
    s.tick();
    expect(kickoff.querySelector('.et-scheduler-appointment-location-text')).toBeNull();
    expect(kickoff.hasAttribute('data-draggable')).toBe(false);

    finish(s);
  });

  it('steps through periods with the toolbar and switches views, writing view and focusedDate back', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;
    const label = () => query('.et-scheduler-header-label', host).textContent?.trim();

    s.tick();

    button('Next', host).click();
    s.tick();
    expect(planner.focusedDate()).toEqual(at(15 + 31, 0));
    expect(label()).toBe('August 2026');

    button('Previous', host).click();
    button('Previous', host).click();
    s.tick();
    expect(label()).toBe('June 2026');

    button('Today', host).click();
    s.tick();
    expect(planner.focusedDate()).toEqual(at(15, 0));

    switchView(s, 'Week', host);
    s.tick();
    expect(planner.view()).toBe('week');
    expect(label()).toBe('July 13\u2009–\u200919, 2026');
    expect(texts('.et-scheduler-time-grid-header-date', host)).toEqual(['13', '14', '15', '16', '17', '18', '19']);

    button('Next', host).click();
    s.tick();
    expect(label()).toBe('July 20\u2009–\u200926, 2026');

    switchView(s, 'Day', host);
    s.tick();
    expect(label()).toBe('Wednesday, July 22nd, 2026');

    switchView(s, 'Agenda', host);
    planner.agendaDays.set(3);
    s.tick();
    expect(label()).toBe('July 22\u2009–\u200924, 2026');

    button('Next', host).click();
    s.tick();
    expect(planner.focusedDate()).toEqual(at(25, 0));

    finish(s);
  });

  it('lays timed appointments out as blocks in the week grid and all-day ones in the all-day lane', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;

    planner.view.set('week');
    planner.businessHours.set([{ daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }]);
    s.tick();

    const days = [...host.querySelectorAll<HTMLElement>('.et-scheduler-time-grid-day')];
    const wednesday = days[2]!;

    expect(wednesday.hasAttribute('data-today')).toBe(true);
    expect(texts('.et-scheduler-time-grid-block .et-scheduler-appointment-title', wednesday)).toEqual([
      'Kickoff',
      'Kickoff prep',
      'Slides',
    ]);

    const prep = query('.et-scheduler-time-grid-block[title="Kickoff prep"]', wednesday);

    expect(prep.hasAttribute('data-nested')).toBe(true);
    expect(prep.style.getPropertyValue('--_et-scheduler-time-grid-block-depth')).toBe('1');
    expect(days.map((day) => day.querySelectorAll('.et-scheduler-time-grid-non-business').length)).toEqual([
      2, 2, 2, 2, 2, 1, 1,
    ]);
    expect(wednesday.querySelectorAll('.et-scheduler-time-grid-now')).toHaveLength(1);

    planner.nowIndicator.set(false);
    planner.focusedDate.set(at(20, 0));
    s.tick();

    expect(host.querySelectorAll('.et-scheduler-time-grid-now')).toHaveLength(0);
    expect(texts('.et-scheduler-time-grid-all-day-entry .et-scheduler-appointment-title', host)).toEqual(['Offsite']);
    expect(
      texts(
        '.et-scheduler-time-grid-block .et-scheduler-appointment-title',
        host.querySelectorAll('.et-scheduler-time-grid-day')[2]!,
      ),
    ).toEqual(['One', 'Two', 'Three', 'Four']);

    finish(s);
  });

  it('lists the chain in the agenda view, nested under its root', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.view.set('agenda');
    s.tick();

    const wednesday = query('.et-scheduler-agenda-view-day', host);

    expect(query('.et-scheduler-agenda-view-day-header', wednesday).hasAttribute('data-today')).toBe(true);
    expect(texts('.et-scheduler-appointment-title', wednesday)).toEqual(['Kickoff', 'Kickoff prep', 'Slides']);
    expect(
      [...wednesday.querySelectorAll('.et-scheduler-appointment')].map((row) => row.hasAttribute('data-nested')),
    ).toEqual([false, true, true]);

    finish(s);
  });

  it('opens the edit surface for a clicked appointment and emits the edited appointment on save', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;

    s.tick();

    query('.et-scheduler-appointment[title="Kickoff"]', host).click();
    s.tick(1000);

    expect(planner.selectedId()).toBe('kickoff');
    expect(query('.et-scheduler-appointment[title="Kickoff"]', host).hasAttribute('data-selected')).toBe(true);
    expect(query('.et-scheduler-edit-surface-title', surface()!).textContent?.trim()).toBe('Kickoff');
    expect(texts('.et-scheduler-edit-surface-children-item-title', surface()!)).toEqual(['Kickoff prep']);

    const title = query<HTMLInputElement>('et-scheduler-edit-title input', surface()!);
    const location = query<HTMLInputElement>('et-scheduler-edit-location input', surface()!);

    expect(title.value).toBe('Kickoff');
    type(s, title, 'Kickoff call');
    type(s, location, 'Room 2');
    type(s, query<HTMLTextAreaElement>('textarea', surface()!), 'Bring the numbers');

    button('Save', surface()!).click();
    s.tick(1000);

    expect(planner.saved()).toMatchObject({
      id: 'kickoff',
      title: 'Kickoff call',
      location: 'Room 2',
      description: 'Bring the numbers',
      start: at(15, 9),
      end: at(15, 10),
    });
    expect(planner.selectedId()).toBeNull();
    expect(surface()).toBeNull();

    finish(s);
  });

  it('centers the edit surface for an appointment picked from the "+N more" menu', () => {
    const viewport = Object.getOwnPropertyDescriptor(window, 'matchMedia');

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (media: string) => ({
        media,
        matches: media.includes('min-width'),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });

    try {
      const s = scenario();
      const fixture = TestBed.createComponent(PlannerComponent);
      const host = fixture.nativeElement as HTMLElement;

      s.tick();

      const trigger = query('.et-scheduler-month-view-overflow-trigger', monthCell(host, 22));

      trigger.focus();
      trigger.click();
      s.tick(1000);
      button('Four').click();
      s.tick(1000);

      expect(query('.et-scheduler-edit-surface-title', surface()!).textContent?.trim()).toBe('Four');
      expect(query('.et-scheduler-edit-surface-panel').style.position).toBe('relative');
      expect(query('.et-scheduler-edit-surface-panel').parentElement?.style.placeItems).toBe('center center');

      button('Cancel', surface()!).click();
      s.tick(1000);
      query('.et-scheduler-appointment[title="Kickoff"]', host).click();
      s.tick(1000);

      expect(query('.et-scheduler-edit-surface-panel').style.position).toBe('absolute');

      finish(s);
    } finally {
      if (viewport) Object.defineProperty(window, 'matchMedia', viewport);
    }
  });

  it('walks the chain inside the edit surface, adds a sub-appointment and deletes with descendants', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const planner = fixture.componentInstance;

    s.tick();

    planner.selectedId.set('prep');
    s.tick(1000);

    expect(texts('.et-scheduler-edit-surface-breadcrumb-item', surface()!)).toEqual(['Kickoff']);
    expect(query('.et-scheduler-edit-surface-breadcrumb-current', surface()!).textContent?.trim()).toBe('Kickoff prep');

    button('Kickoff', query('.et-scheduler-edit-surface-breadcrumb', surface()!)).click();
    s.tick();
    expect(query('.et-scheduler-edit-surface-title', surface()!).textContent?.trim()).toBe('Kickoff');

    button('More actions', surface()!).click();
    s.tick(1000);
    button('Add sub-appointment').click();
    s.tick(1000);

    expect(query('.et-scheduler-edit-surface-title', surface()!).textContent?.trim()).toBe('Untitled appointment');
    expect(button('Save', surface()!).disabled).toBe(true);

    type(s, query<HTMLInputElement>('input', surface()!), 'Book a room');
    expect(button('Save', surface()!).disabled).toBe(false);
    button('Save', surface()!).click();
    s.tick(1000);

    expect(planner.saved()).toMatchObject({ parentId: 'kickoff', title: 'Book a room', start: at(15, 9) });

    planner.selectedId.set('kickoff');
    s.tick(1000);
    button('More actions', surface()!).click();
    s.tick(1000);
    button('Delete (with descendants)').click();
    s.tick(1000);

    expect(planner.deleted()).toEqual(['kickoff', 'prep', 'slides']);
    expect(surface()).toBeNull();

    finish(s);
  });

  it('adds a blank appointment from the toolbar on the focused day', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;

    s.tick();

    button('Add appointment', host).click();
    s.tick(1000);

    expect(query('.et-scheduler-edit-surface-title', surface()!).textContent?.trim()).toBe('Untitled appointment');

    type(s, query<HTMLInputElement>('input', surface()!), 'Standup');
    button('Save', surface()!).click();
    s.tick(1000);

    expect(planner.saved()).toMatchObject({ parentId: null, title: 'Standup', start: at(15, 9), end: at(15, 10) });

    planner.canAdd.set(false);
    s.tick();
    expect(() => button('Add appointment', host)).toThrow();

    finish(s);
  });

  it('creates an all-day appointment from the keyboard on a focused month cell', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;

    s.tick();

    const focused = monthCell(host, 15);

    expect(focused.getAttribute('tabindex')).toBe('0');
    focused.focus();
    s.keydown('ArrowRight', focused);
    s.tick();
    expect(monthCell(host, 16).getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(monthCell(host, 16));

    s.keydown(' ', monthCell(host, 16));
    s.tick(1000);

    expect(monthCell(host, 16).hasAttribute('data-draft')).toBe(true);
    expect(surface()).not.toBeNull();

    type(s, query<HTMLInputElement>('input', surface()!), 'Holiday');
    button('Save', surface()!).click();
    s.tick(1000);

    expect(planner.saved()).toMatchObject({ title: 'Holiday', allDay: true, start: at(16, 0) });
    expect(monthCell(host, 16).hasAttribute('data-draft')).toBe(false);

    finish(s);
  });

  it('previews and emits a reschedule driven through the headless drag API', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;
    const headless = planner.scheduler().headless;
    const kickoff = APPOINTMENTS[0]!;

    s.tick();

    headless.beginAppointmentDrag(kickoff, 'move');
    headless.updateAppointmentDrag(at(17, 9), at(17, 10));
    s.tick();

    expect(query('.et-scheduler-appointment[title="Kickoff"]', monthCell(host, 17)).hasAttribute('data-dragging')).toBe(
      true,
    );
    expect(monthCell(host, 17).hasAttribute('data-drop-target')).toBe(true);
    expect(monthCell(host, 15).querySelector('[title="Kickoff"]')).toBeNull();

    headless.commitAppointmentDrag();
    s.tick();

    expect(planner.rescheduled()?.previous).toBe(kickoff);
    expect(planner.rescheduled()?.appointment).toMatchObject({ id: 'kickoff', start: at(17, 9), end: at(17, 10) });
    expect(monthCell(host, 15).querySelector('[title="Kickoff"]')).not.toBeNull();

    finish(s);
  });

  it('steps a period on a horizontal touch swipe', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const planner = fixture.componentInstance;
    const element = planner.scheduler().element;
    const touch = (kind: string, clientX: number) => {
      const point = { clientX, clientY: 200 } as Touch;

      element.dispatchEvent(
        Object.assign(new Event(kind, { bubbles: true, cancelable: true }), {
          touches: [point],
          targetTouches: [point],
          changedTouches: [point],
        }),
      );
    };

    s.tick();

    touch('touchstart', 300);
    touch('touchmove', 200);
    touch('touchmove', 100);
    touch('touchend', 100);
    s.tick();

    expect(planner.focusedDate()).toEqual(at(15 + 31, 0));

    finish(s);
  });

  it('creates nothing when a touch on an empty slot moves before the long press arms', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;

    planner.view.set('week');
    planner.nowIndicator.set(false);
    s.tick();

    const tuesday = host.querySelectorAll<HTMLElement>('.et-scheduler-time-grid-day')[1]!;
    const pointer = { pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0, bubbles: true };

    tuesday.setPointerCapture = () => undefined;
    tuesday.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: 300, clientY: 200 }));
    document.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 200, clientY: 200 }));
    document.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 100, clientY: 200 }));
    document.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 100, clientY: 200 }));
    s.tick(1000);

    expect(host.querySelector('.et-scheduler-time-grid-draft')).toBeNull();
    expect(surface()).toBeNull();

    tuesday.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: 300, clientY: 200 }));
    document.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 300, clientY: 200 }));
    s.tick(1000);

    expect(surface()).not.toBeNull();

    finish(s);
  });
});

describe('scheduler scenarios with app-wide labels', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemesWithTailwind4(SCHEDULER_COLOR_THEMES),
      provideSchedulerEditSurface(),
      provideSchedulerLabels({
        previous: 'Zurück',
        next: 'Weiter',
        week: 'Woche',
        addAppointment: 'Termin anlegen',
        moreAppointments: (count) => `+${count} weitere`,
        save: 'Speichern',
      }),
    ],
  });

  beforeEach(() => vi.setSystemTime(at(15, 8, 30)));

  it('renders the provided labels in the toolbar, grid and edit surface and keeps the defaults for the rest', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(s.run(injectSchedulerLabels)().today).toBe(DEFAULT_SCHEDULER_LABELS.today);
    expect(TestBed.inject(SCHEDULER_LABELS)).toMatchObject({ next: 'Weiter' });
    expect(query('.et-scheduler-month-view-overflow-trigger', monthCell(host, 22)).textContent?.trim()).toBe(
      '+1 weitere',
    );
    expect(button('Zurück', host)).toBeTruthy();
    expect(button('Today', host)).toBeTruthy();

    button('Weiter', host).click();
    button('Zurück', host).click();
    switchView(s, 'Woche', host);
    expect(fixture.componentInstance.view()).toBe('week');

    button('Termin anlegen', host).click();
    s.tick(1000);
    expect(button('Speichern', surface()!).disabled).toBe(true);

    fixture.componentInstance.nowIndicator.set(false);
    finish(s);
  });
});

describe('scheduler misuse scenarios', () => {
  const scenario = useScenario({
    providers: [provideOverlay(), provideColorThemesWithTailwind4(SCHEDULER_COLOR_THEMES)],
  });

  beforeEach(() => vi.setSystemTime(at(15, 8, 30)));

  it('rejects features placed outside the element they extend', () => {
    const s = scenario();

    for (const [stray, expected] of [
      [StrayBadgeComponent, SCHEDULER_ERROR_CODES.FEATURE_OUTSIDE_SCHEDULER],
      [StrayFieldComponent, SCHEDULER_ERROR_CODES.EDIT_SURFACE_FEATURE_OUTSIDE_SURFACE],
      [StraySwipeComponent, SCHEDULER_ERROR_CODES.SWIPE_NAVIGATION_OUTSIDE_SCHEDULER],
      [StrayDragComponent, SCHEDULER_ERROR_CODES.APPOINTMENT_DRAG_OUTSIDE_SCHEDULER],
    ] as const) {
      expect(() => TestBed.createComponent(stray)).toThrow(code(expected));
    }

    TestBed.createComponent(StrayViewComponent);
    s.tick();
    s.expectError(code(SCHEDULER_ERROR_CODES.VIEW_OUTSIDE_SCHEDULER));

    s.tick(1);
    expect(dropElementPayloads(s)).toHaveLength(3);
  });

  it('only selects without a registered edit surface, and reports malformed business hours', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlannerComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    query('.et-scheduler-appointment[title="Kickoff"]', host).click();
    expect(() => fixture.detectChanges()).not.toThrow();
    s.tick();
    expect(fixture.componentInstance.selectedId()).not.toBeNull();
    expect(host.querySelector('.et-scheduler-toolbar-action')).toBeNull();
    expect(document.querySelector('et-scheduler-edit-surface')).toBeNull();

    fixture.componentInstance.nowIndicator.set(false);
    fixture.componentInstance.view.set('week');
    fixture.componentInstance.businessHours.set([
      { daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
      { daysOfWeek: [1], start: '17:00', end: '09:00' },
    ]);
    expect(() => fixture.detectChanges()).not.toThrow();
    s.tick();
    s.expectError(code(SCHEDULER_ERROR_CODES.INVALID_BUSINESS_HOURS));
    expect(host.querySelector('.et-scheduler-time-grid-non-business')).toBeNull();

    fixture.componentInstance.businessHours.set(null);
    finish(s);
  });
});
