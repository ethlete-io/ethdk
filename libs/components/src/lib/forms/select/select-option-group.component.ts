import { Component, ViewEncapsulation, inject } from '@angular/core';
import { createComponentId } from '@ethlete/core';
import { SelectOptionGroupDirective } from './headless';

@Component({
  selector: 'et-select-option-group',
  template: `
    <div [id]="labelId" class="et-select-option-group-label">{{ group.label() }}</div>
    <ng-content />
  `,
  styleUrl: './select-option-group.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: SelectOptionGroupDirective, inputs: ['label'] }],
  host: {
    class: 'et-select-option-group',
  },
})
export class SelectOptionGroupComponent {
  protected group = inject(SelectOptionGroupDirective);

  protected readonly labelId = createComponentId('et-select-option-group-label');

  constructor() {
    this.group.labelledById.set(this.labelId);
  }
}
