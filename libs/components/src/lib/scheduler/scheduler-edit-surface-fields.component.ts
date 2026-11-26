import { Component, ViewEncapsulation } from '@angular/core';

/** Stacks the edit surface's fields - its content - with the spacing the default surface uses. */
@Component({
  selector: 'et-scheduler-edit-surface-fields',
  template: `<ng-content />`,
  styleUrl: './scheduler-edit-surface-fields.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-scheduler-edit-surface-fields',
  },
})
export class SchedulerEditSurfaceFieldsComponent {}
