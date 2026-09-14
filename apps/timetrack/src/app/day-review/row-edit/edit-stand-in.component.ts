import {
  Component,
  Directive,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  input,
} from '@angular/core';
import { Appointment, FORM_FIELD_IMPORTS, SELECT_IMPORTS, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { injectDayReview } from '../day-review';
import { rowEntryOf } from './row-appointment';

/**
 * The name the user gave this band's work, while Jira holds no issue for it.
 *
 * It writes as soon as it is picked, rather than on save, and clears the issue field in the same
 * breath: the two answers are one question to the reviewer, and a band holding both would read as
 * bookable through `isNamedRow` while showing the stand-in's name.
 */
@Component({
  selector: 'ethlete-edit-stand-in',
  template: `
    <et-form-field>
      <et-label>Or a name you gave</et-label>
      <et-select
        [value]="standInId() || null"
        (valueChange)="pick($event)"
        aria-label="A name you gave this work"
        placeholder="Pick a name"
      >
        @for (standIn of offers(); track standIn.id) {
          <et-select-option [value]="standIn.id" [label]="standIn.name">{{ standIn.name }}</et-select-option>
        }
      </et-select>
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS],
})
export class EditStandInComponent {
  private store = injectDayReview();

  public draft = input.required<WritableSignal<Appointment>>();

  public row = computed(() => rowEntryOf(this.draft()())?.row);

  protected standInId = computed(() => this.row()?.standInId ?? '');

  /**
   * The open stand-ins, with the one this band already carries kept in the list.
   *
   * A resolved stand-in is off the list and the band may still name it, and a select whose value is
   * not among its options shows nothing at all.
   */
  protected offers = computed(() => {
    const open = this.store.openStandIns();
    const held = this.standInId();

    if (!held || open.some((standIn) => standIn.id === held)) return open;

    return [...this.store.allStandIns().filter((standIn) => standIn.id === held), ...open];
  });

  protected pick(value: unknown) {
    const standInId = typeof value === 'string' ? value : '';
    const row = this.row();

    if (!row || !standInId || standInId === this.standInId()) return;

    this.store.setStandIn(row, standInId);
    this.draft().update((appointment) => ({ ...appointment, title: '' }));
  }
}

@Directive({ selector: '[ethleteEditStandIn]' })
export class EditStandInDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditStandIn');
  private store = injectDayReview();

  constructor() {
    this.host.registerEditField({
      component: EditStandInComponent,
      injector: inject(Injector),
      order: 1,
      enabled: computed(() => this.store.openStandIns().length > 0),
    });
  }
}
