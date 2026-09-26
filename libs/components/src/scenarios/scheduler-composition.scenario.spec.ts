import { NgComponentOutlet } from '@angular/common';
import {
  Component,
  computed,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  inputBinding,
  signal,
  viewChild,
  ViewEncapsulation,
  WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  Appointment,
  AppointmentId,
  AppointmentTreeNode,
  countDescendants,
  createOverlayOpener,
  defineOverlay,
  injectDialogStrategy,
  injectSchedulerEditSurfaceHost,
  injectSchedulerFeatureHost,
  OVERLAY_REF,
  OverlayRef,
  provideOverlay,
  SCHEDULER_ADD_SURFACE_OVERLAY,
  SCHEDULER_EDIT_IMPORTS,
  SCHEDULER_EDIT_SURFACE,
  SCHEDULER_EDIT_SURFACE_HOST,
  SCHEDULER_EDIT_SURFACE_OVERLAY,
  SCHEDULER_FEATURE_HOST,
  SCHEDULER_IMPORTS,
  SchedulerActionAddAppointmentDirective,
  SchedulerActionAddSubAppointmentDirective,
  SchedulerActionDeleteDirective,
  SchedulerAgendaDirective,
  SchedulerAgendaViewComponent,
  SchedulerAppointmentAction,
  SchedulerAppointmentDragDirective,
  SchedulerBadgeAdornment,
  SchedulerBadgeChainCountComponent,
  SchedulerBadgeChainCountDirective,
  SchedulerBadgeColorDotComponent,
  SchedulerBadgeColorDotDirective,
  SchedulerBadgeLocationComponent,
  SchedulerBadgeLocationDirective,
  SchedulerBadgeTimeRangeComponent,
  SchedulerBadgeTimeRangeDirective,
  SchedulerBadgeTitleComponent,
  SchedulerBadgeTitleDirective,
  SchedulerDirective,
  SchedulerEditColorComponent,
  SchedulerEditColorDirective,
  SchedulerEditDescriptionDirective,
  SchedulerEditLocationDirective,
  SchedulerEditTimeRangeDirective,
  SchedulerEditTitleDirective,
  SchedulerEditDescriptionComponent,
  SchedulerEditField,
  SchedulerEditLocationComponent,
  SchedulerEditSurfaceComponent,
  SchedulerEditSurfaceDirective,
  SchedulerEditSurfaceHost,
  SchedulerEditSurfaceResult,
  SchedulerEditTimeRangeComponent,
  SchedulerEditTitleComponent,
  SchedulerFeatureConfig,
  schedulerFeatureConfig,
  SchedulerFeatureHost,
  SchedulerMonthDirective,
  SchedulerMonthViewComponent,
  SchedulerSwipeNavigationDirective,
  SchedulerTimeGridDirective,
  SchedulerTimeGridViewComponent,
  SchedulerToolbarAction,
  SchedulerView,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

// jsdom loads no component stylesheets, so the dimension observers would see inline hosts.
const UNSTYLED_BLOCKS = 'et-scheduler, et-overlay-body { display: block; }';

type Ticket = { estimate: number };

const at = (day: number, hour: number, minute = 0) => new Date(2026, 6, day, hour, minute);

const appointment = (id: AppointmentId, overrides: Partial<Appointment<Ticket>> = {}): Appointment<Ticket> => ({
  id,
  parentId: null,
  title: id,
  start: at(15, 9),
  end: at(15, 10),
  ...overrides,
});

const APPOINTMENTS: Appointment<Ticket>[] = [
  appointment('review', { title: 'Review', location: 'Hall', colorToken: 'primary', extra: { estimate: 2 } }),
  appointment('draft', { parentId: 'review', title: 'Draft', start: at(15, 11), end: at(15, 12) }),
  appointment('notes', { parentId: 'draft', title: 'Notes', start: at(15, 13), end: at(15, 14) }),
  appointment('retreat', { title: 'Retreat', start: at(16, 0), end: at(17, 23, 59), allDay: true }),
];

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const texts = (selector: string, root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLElement>(selector)].map((element) => (element.textContent ?? '').trim());

const type = (s: Scenario, field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

@Component({
  selector: 'et-scenario-subtask-badge',
  template: `<span class="subtasks">{{ count() }} subtasks</span>`,
})
class SubtaskBadgeComponent {
  node = input.required<AppointmentTreeNode>();
  count = computed(() => countDescendants(this.node()));
}

@Directive({ selector: '[appSubtaskBadge]' })
class SubtaskBadgeDirective {
  private host = injectSchedulerFeatureHost('appSubtaskBadge');
  config = input({} as SchedulerFeatureConfig, {
    alias: 'appSubtaskBadge',
    transform: schedulerFeatureConfig<SchedulerFeatureConfig>,
  });

  constructor() {
    this.host.registerBadgeAdornment({
      component: SubtaskBadgeComponent,
      order: 5,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}

@Component({
  selector: 'et-scenario-shell',
  imports: [
    SchedulerDirective,
    SchedulerMonthViewComponent,
    SchedulerTimeGridViewComponent,
    SchedulerAgendaViewComponent,
    SchedulerBadgeTitleDirective,
    SchedulerBadgeTimeRangeDirective,
    SchedulerBadgeColorDotDirective,
    SchedulerBadgeLocationDirective,
    SchedulerBadgeChainCountDirective,
    SchedulerActionAddAppointmentDirective,
    SchedulerSwipeNavigationDirective,
    SchedulerAppointmentDragDirective,
    SubtaskBadgeDirective,
  ],
  providers: [{ provide: SCHEDULER_FEATURE_HOST, useExisting: ShellComponent }],
  template: `
    <section
      #calendar="etScheduler"
      [(view)]="view"
      [(focusedDate)]="focusedDate"
      [(selectedAppointmentId)]="selectedId"
      [appointments]="data"
      [firstDayOfWeek]="1"
      [etSchedulerBadgeChainCount]="{ enabled: showChain() }"
      [appSubtaskBadge]="{ enabled: showSubtasks() }"
      (appointmentReschedule)="rescheduled.set($event.appointment)"
      etScheduler
      etSchedulerBadgeTitle
      etSchedulerBadgeTimeRange
      etSchedulerBadgeColorDot
      etSchedulerBadgeLocation
      etSchedulerActionAddAppointment
      etSchedulerSwipeNavigation
      etSchedulerAppointmentDrag
    >
      <nav>
        @for (action of toolbarActions(); track $index) {
          <button (click)="action.run()" class="shell-action" type="button">{{ action.label() }}</button>
        }
        <button (click)="calendar.next()" class="shell-next" type="button">Forward</button>
      </nav>

      @switch (calendar.view()) {
        @case ('week') {
          <et-scheduler-time-grid-view />
        }
        @case ('agenda') {
          <et-scheduler-agenda-view />
        }
        @default {
          <et-scheduler-month-view />
        }
      }
    </section>
  `,
})
class ShellComponent implements SchedulerFeatureHost {
  private calendar = viewChild.required(SchedulerDirective);
  element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  view = signal<SchedulerView>('month');
  focusedDate = signal(at(15, 0));
  selectedId = signal<AppointmentId | null>(null);
  data = APPOINTMENTS;
  showChain = signal(true);
  showSubtasks = signal(true);
  addRequests = signal(0);
  rescheduled = signal<Appointment | null>(null);
  private adornments = signal<SchedulerBadgeAdornment[]>([]);
  private actions = signal<SchedulerToolbarAction[]>([]);

  badgeAdornments = computed(() =>
    this.adornments()
      .filter((adornment) => adornment.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  toolbarActions = computed(() => this.actions().filter((action) => action.enabled?.() ?? true));

  appointmentTree = () => this.calendar().appointmentTree();
  selectedAppointment = () => this.calendar().selectedAppointment();

  appointments() {
    return this.calendar().visibleAppointments();
  }

  registerBadgeAdornment(adornment: SchedulerBadgeAdornment) {
    this.adornments.update((list) => [...list, adornment]);
  }

  registerToolbarAction(action: SchedulerToolbarAction) {
    this.actions.update((list) => [...list, action]);
  }

  addAppointment() {
    this.addRequests.update((count) => count + 1);
  }
}

@Component({
  selector: 'et-scenario-layouts',
  imports: [
    SchedulerDirective,
    SchedulerMonthDirective,
    SchedulerTimeGridDirective,
    SchedulerAgendaDirective,
    SchedulerBadgeTitleComponent,
    SchedulerBadgeTimeRangeComponent,
    SchedulerBadgeLocationComponent,
    SchedulerBadgeChainCountComponent,
    SchedulerBadgeColorDotComponent,
  ],
  template: `
    <div [appointments]="appointments" [focusedDate]="focusedDate" [firstDayOfWeek]="1" etScheduler view="week">
      <div #month="etSchedulerMonth" [maxVisiblePerCell]="1" etSchedulerMonth></div>

      <div #grid="etSchedulerTimeGrid" etSchedulerTimeGrid>
        @for (day of grid.days(); track day.date.getTime()) {
          <div class="grid-day">
            @for (block of day.blocks; track block.node.appointment.id) {
              <span [style.top.%]="block.offset" class="grid-block">
                <et-scheduler-badge-title [node]="block.node" />
              </span>
            }
          </div>
        }
      </div>

      <ol #agenda="etSchedulerAgenda" etSchedulerAgenda>
        @for (day of agenda.days(); track day.date.getTime()) {
          @for (node of day.nodes; track node.appointment.id) {
            <li class="agenda-row">
              <et-scheduler-badge-color-dot [node]="node" />
              <et-scheduler-badge-title [node]="node" />
              <et-scheduler-badge-time-range [node]="node" />
              <et-scheduler-badge-location [node]="node" />
              <et-scheduler-badge-chain-count [node]="node" />
            </li>
          }
        }
      </ol>
    </div>
  `,
})
class LayoutsComponent {
  appointments = APPOINTMENTS;
  focusedDate = at(15, 0);
  month = viewChild.required(SchedulerMonthDirective);
  grid = viewChild.required(SchedulerTimeGridDirective);
  agenda = viewChild.required(SchedulerAgendaDirective);
}

@Component({
  selector: 'et-scenario-estimate-field',
  template: `<label>Estimate <input [value]="value()" (input)="update($event)" class="estimate" /></label>`,
})
class EstimateFieldComponent {
  draft = input.required<WritableSignal<Appointment>>();
  value = computed(() => (this.draft()().extra as Ticket | undefined)?.estimate ?? 0);

  update(event: Event) {
    const estimate = Number((event.target as HTMLInputElement).value);

    this.draft().update((current) => ({ ...current, extra: { estimate } }));
  }
}

@Directive({ selector: '[appEstimateField]' })
class EstimateFieldDirective {
  private host = injectSchedulerEditSurfaceHost('appEstimateField');

  constructor() {
    this.host.registerEditField({
      component: EstimateFieldComponent,
      injector: inject(Injector),
      order: 50,
      valid: computed(() => ((this.host.appointment().extra as Ticket | undefined)?.estimate ?? 0) >= 0),
    });
  }
}

@Component({
  selector: 'et-scenario-edit-sheet',
  imports: [
    NgComponentOutlet,
    SchedulerEditSurfaceDirective,
    SchedulerEditTitleDirective,
    SchedulerEditTimeRangeDirective,
    SchedulerEditLocationDirective,
    SchedulerEditDescriptionDirective,
    SchedulerEditColorDirective,
    SchedulerActionAddSubAppointmentDirective,
    SchedulerActionDeleteDirective,
    EstimateFieldDirective,
  ],
  providers: [{ provide: SCHEDULER_EDIT_SURFACE_HOST, useExisting: EditSheetComponent }],
  template: `
    <div
      #surface="etSchedulerEditSurface"
      [appointment]="appointment()"
      [appointments]="appointments()"
      [etSchedulerEditLocation]="{ enabled: false }"
      (save)="close({ kind: 'save', appointment: $event })"
      (deleteAppointments)="close({ kind: 'delete', ids: $event })"
      etSchedulerEditSurface
      etSchedulerEditTitle
      etSchedulerEditTimeRange
      etSchedulerEditDescription
      etSchedulerEditColor
      etSchedulerActionAddSubAppointment
      etSchedulerActionDelete
      appEstimateField
    >
      <h2 class="sheet-title">{{ surface.currentAppointment().title }}</h2>
      @for (field of editFields(); track $index) {
        <ng-container
          *ngComponentOutlet="field.component; inputs: { draft: surface.draft }; injector: field.injector"
        />
      }
      @for (action of appointmentActions(); track $index) {
        <button (click)="action.run()" class="sheet-action" type="button">{{ action.label() }}</button>
      }
      <button [disabled]="!canSave()" (click)="surface.commit()" class="sheet-save" type="button">Save</button>
    </div>
  `,
})
class EditSheetComponent implements SchedulerEditSurfaceHost {
  private overlayRef = inject<OverlayRef<object, SchedulerEditSurfaceResult>>(OVERLAY_REF);
  private surface = viewChild.required(SchedulerEditSurfaceDirective);
  appointment = input.required<Appointment>();
  appointments = input<readonly Appointment[]>([]);
  element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private fields = signal<SchedulerEditField[]>([]);
  private actions = signal<SchedulerAppointmentAction[]>([]);

  editFields = computed(() =>
    this.fields()
      .filter((field) => field.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  appointmentActions = computed(() =>
    this.actions()
      .filter((action) => action.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  canSave = computed(() => this.editFields().every((field) => field.valid?.() ?? true));

  appointmentTree = () => this.surface().appointmentTree();

  registerEditField(field: SchedulerEditField) {
    this.fields.update((list) => [...list, field]);
  }

  registerAppointmentAction(action: SchedulerAppointmentAction) {
    this.actions.update((list) => [...list, action]);
  }

  close(result: SchedulerEditSurfaceResult) {
    this.overlayRef.close(result);
  }
}

const EDIT_SHEET_OVERLAY = defineOverlay<EditSheetComponent, SchedulerEditSurfaceResult>({
  component: EditSheetComponent,
  strategies: () => {
    const dialogStrategy = injectDialogStrategy();

    return [{ strategy: dialogStrategy.build() }];
  },
});

@Component({
  selector: 'et-scenario-sheet-planner',
  imports: [SCHEDULER_IMPORTS],
  providers: [
    {
      provide: SCHEDULER_EDIT_SURFACE,
      useValue: { editOverlay: EDIT_SHEET_OVERLAY, addOverlay: SCHEDULER_ADD_SURFACE_OVERLAY },
    },
  ],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <et-scheduler
      [appointments]="appointments"
      [focusedDate]="focusedDate"
      (appointmentSave)="saved.set($event)"
      (appointmentsDelete)="deleted.set($event)"
    />
  `,
})
class SheetPlannerComponent {
  appointments = APPOINTMENTS;
  focusedDate = at(15, 0);
  saved = signal<Appointment | null>(null);
  deleted = signal<readonly AppointmentId[] | null>(null);
}

@Component({
  selector: 'et-scenario-quick-edit',
  imports: [
    SCHEDULER_EDIT_IMPORTS,
    SchedulerEditTitleComponent,
    SchedulerEditTimeRangeComponent,
    SchedulerEditLocationComponent,
    SchedulerEditDescriptionComponent,
    SchedulerEditColorComponent,
  ],
  template: `
    <form
      #surface="etSchedulerEditSurface"
      [appointment]="appointment"
      (save)="saved.set($event)"
      (submit)="$event.preventDefault(); surface.commit()"
      etSchedulerEditSurface
    >
      <et-scheduler-edit-title [draft]="surface.draft" />
      <et-scheduler-edit-time-range [draft]="surface.draft" />
      <et-scheduler-edit-location [draft]="surface.draft" />
      <et-scheduler-edit-description [draft]="surface.draft" />
      <et-scheduler-edit-color [draft]="surface.draft" />
      <button type="submit">Keep</button>
    </form>
  `,
})
class QuickEditComponent {
  appointment = APPOINTMENTS[0]!;
  saved = signal<Appointment | null>(null);
}

@Component({
  selector: 'et-scenario-sidebar',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: ``,
})
class SidebarComponent {
  result = signal<SchedulerEditSurfaceResult | null>(null);
  private opener = createOverlayOpener(SCHEDULER_EDIT_SURFACE_OVERLAY, {
    afterClosed: (result) => this.result.set(result ?? null),
  });

  edit(target: Appointment) {
    return this.opener.open({
      bindings: [inputBinding('appointment', () => target), inputBinding('appointments', () => APPOINTMENTS)],
    });
  }
}

describe('scheduler composition scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemesWithTailwind4(COLOR_THEMES)] });

  beforeEach(() => vi.setSystemTime(at(15, 8, 30)));

  it('drives the stock views from an own shell that hosts the badge and toolbar features', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShellComponent);
    const host = fixture.nativeElement as HTMLElement;
    const shell = fixture.componentInstance;

    s.flush();

    const review = query('.et-scheduler-appointment[title="Review"]', host);

    expect([...review.children].map((child) => child.tagName.toLowerCase())).toEqual([
      'et-scheduler-badge-color-dot',
      'et-scheduler-badge-title',
      'et-scenario-subtask-badge',
      'et-scheduler-badge-time-range',
      'et-scheduler-badge-location',
      'et-scheduler-badge-chain-count',
    ]);
    expect(query('.subtasks', review).textContent).toBe('2 subtasks');
    expect(review.hasAttribute('data-draggable')).toBe(true);

    shell.showChain.set(false);
    shell.showSubtasks.set(false);
    s.tick();
    expect(review.querySelector('.subtasks')).toBeNull();
    expect(review.querySelector('.et-scheduler-appointment-chain-count')).toBeNull();

    expect(texts('.shell-action', host)).toEqual(['Add appointment']);
    query('.shell-action', host).click();
    expect(shell.addRequests()).toBe(1);

    review.click();
    s.tick();
    expect(shell.selectedId()).toBe('review');
    expect(shell.selectedAppointment()?.title).toBe('Review');
    expect(shell.appointments().map((entry) => entry.id)).toEqual(['review', 'draft', 'notes', 'retreat']);

    shell.view.set('week');
    s.tick();
    expect(texts('.et-scheduler-time-grid-block .et-scheduler-appointment-title', host)).toEqual([
      'Review',
      'Draft',
      'Notes',
    ]);

    shell.view.set('agenda');
    s.tick();
    expect(texts('.et-scheduler-agenda-view-day .et-scheduler-appointment-title', host)).toContain('Retreat');

    query('.shell-next', host).click();
    s.tick();
    expect(shell.focusedDate()).toEqual(at(22, 0));
    s.flush();
  });

  it('commits a keyboard-drawn range on the headless state for an own create flow', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShellComponent);
    const host = fixture.nativeElement as HTMLElement;
    const calendar = fixture.debugElement.children[0]!.injector.get(SchedulerDirective);

    s.flush();

    const cells = [...host.querySelectorAll<HTMLElement>('.et-scheduler-month-view-cell')];
    const today = host.querySelector<HTMLElement>('.et-scheduler-month-view-cell[tabindex="0"]')!;
    const endOfDay = (day: number) => new Date(2026, 6, day, 23, 59, 59, 999);

    s.keydown('Enter', today);
    expect(calendar.draftRange()).toBeNull();
    expect(document.activeElement?.getAttribute('title')).toBe('Review');

    s.keydown(' ', today);
    expect(calendar.draftRange()).toEqual({ start: at(15, 0), end: endOfDay(15), allDay: true, phase: 'committed' });

    calendar.clearDraftRange();
    s.keydown('Enter', cells[0]!);
    expect(calendar.draftRange()).toMatchObject({ start: new Date(2026, 5, 29), phase: 'committed' });

    calendar.clearDraftRange();
    s.flush();
  });

  it('lays out month, time grid and agenda data for an own template through the headless directives', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LayoutsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const layouts = fixture.componentInstance;

    s.tick();

    const weeks = layouts.month().weeks();
    const wednesday = weeks.flat().find((cell) => cell.date.getTime() === at(15, 0).getTime())!;

    expect(weeks).toHaveLength(5);
    expect(wednesday.today).toBe(true);
    expect(wednesday.visible.map((node) => node.appointment.id)).toEqual(['review']);
    expect(wednesday.overflow.map((node) => node.appointment.id)).toEqual(['draft', 'notes']);

    expect(layouts.grid().days()).toHaveLength(7);
    expect(
      layouts
        .grid()
        .allDay()
        .map((entry) => entry.node.appointment.id),
    ).toEqual(['retreat']);
    expect(layouts.grid().allDayRowCount()).toBe(1);
    expect([...host.querySelectorAll('.grid-day')].map((day) => texts('.et-scheduler-appointment-title', day))).toEqual(
      [[], [], ['Review', 'Draft', 'Notes'], [], [], [], []],
    );
    expect(parseFloat(query('.grid-block', host).style.top)).toBeCloseTo(37.5, 3);

    expect(
      layouts
        .agenda()
        .days()
        .map((day) => day.nodes.length),
    ).toEqual([0, 0, 3, 1, 1, 0, 0]);

    const [review, draft] = [...host.querySelectorAll<HTMLElement>('.agenda-row')];

    expect(query('.et-scheduler-appointment-dot', review)).toBeTruthy();
    expect(query('.et-scheduler-appointment-time-range', review!).textContent?.trim()).toBe('09:00–10:00');
    expect(query('.et-scheduler-appointment-location-text', review!).textContent?.trim()).toBe('Hall');
    expect(query('.et-scheduler-appointment-chain-count', review!).textContent?.trim()).toBe('2');
    expect(query('.et-scheduler-appointment-chain-count', draft!).textContent?.trim()).toBe('1');
    s.tick();
  });

  it('opens an own edit surface registered through SCHEDULER_EDIT_SURFACE, with custom fields and actions', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SheetPlannerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const planner = fixture.componentInstance;
    const sheet = () => document.querySelector<HTMLElement>('et-scenario-edit-sheet');

    s.tick();

    query('.et-scheduler-appointment[title="Review"]', host).click();
    s.tick(1000);

    expect(query('.sheet-title', sheet()!).textContent).toBe('Review');
    expect(
      [...query('[etschedulereditsurface]', sheet()!).children]
        .map((child) => child.tagName.toLowerCase())
        .filter((tag) => tag.includes('-')),
    ).toEqual([
      'et-scheduler-edit-title',
      'et-scheduler-edit-time-range',
      'et-scheduler-edit-description',
      'et-scheduler-edit-color',
      'et-scenario-estimate-field',
    ]);
    expect(texts('.sheet-action', sheet()!)).toEqual(['Add sub-appointment', 'Delete (with descendants)']);

    const title = query<HTMLInputElement>('et-scheduler-edit-title input', sheet()!);

    type(s, title, '  ');
    expect(query<HTMLButtonElement>('.sheet-save', sheet()!).disabled).toBe(true);
    type(s, title, 'Review round');
    type(s, query<HTMLInputElement>('et-scheduler-edit-color input', sheet()!), 'alert');
    type(s, query<HTMLInputElement>('.estimate', sheet()!), '5');

    query('.sheet-save', sheet()!).click();
    s.tick(1000);

    expect(planner.saved()).toMatchObject({
      id: 'review',
      title: 'Review round',
      colorToken: 'alert',
      extra: { estimate: 5 },
    });
    expect(sheet()).toBeNull();

    query('.et-scheduler-appointment[title="Draft"]', host).click();
    s.tick(1000);
    [...sheet()!.querySelectorAll<HTMLButtonElement>('.sheet-action')][1]!.click();
    s.tick(1000);

    expect(planner.deleted()).toEqual(['draft', 'notes']);

    query('.et-scheduler-toolbar-action', host).click();
    s.tick(1000);

    const added = document.querySelector<HTMLElement>('et-scheduler-edit-surface');

    expect(added).not.toBeNull();
    query<HTMLButtonElement>('[etoverlayclose]', added!).click();
    s.tick(1000);
    s.flush();
  });

  it('edits an appointment inline with the built-in field components on a bare headless surface', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(QuickEditComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    expect(query<HTMLInputElement>('et-scheduler-edit-title input', host).value).toBe('Review');
    expect(query<HTMLInputElement>('et-scheduler-edit-location input', host).value).toBe('Hall');
    expect(query<HTMLInputElement>('et-scheduler-edit-color input', host).value).toBe('primary');

    type(s, query<HTMLInputElement>('et-scheduler-edit-location input', host), 'Annex');
    type(s, query<HTMLTextAreaElement>('et-scheduler-edit-description textarea', host), 'Agenda first');
    type(s, query<HTMLInputElement>('et-scheduler-edit-color input', host), '');

    query('button[type="submit"]', host).click();
    s.tick();

    expect(fixture.componentInstance.saved()).toMatchObject({
      id: 'review',
      location: 'Annex',
      description: 'Agenda first',
      colorToken: undefined,
      start: at(15, 9),
      end: at(15, 10),
    });
    s.flush();
  });

  it('opens the stock edit surface from own UI outside any scheduler', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SidebarComponent);

    s.flush();

    const ref = fixture.componentInstance.edit(APPOINTMENTS[1]!);

    s.tick(1000);

    expect(ref.componentInstance()).toBeInstanceOf(SchedulerEditSurfaceComponent);
    expect(texts('.et-scheduler-edit-surface-breadcrumb-item')).toEqual(['Review']);
    expect(texts('.et-scheduler-edit-surface-children-item-title')).toEqual(['Notes']);

    const save = [...document.querySelectorAll<HTMLButtonElement>('et-scheduler-edit-surface button')].find(
      (candidate) => candidate.textContent?.trim() === 'Save',
    )!;

    save.click();
    s.tick(1000);

    expect(fixture.componentInstance.result()).toEqual({ kind: 'save', appointment: APPOINTMENTS[1] });
    s.flush();
  });
});
