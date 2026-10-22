import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { CASCADER_IMPORTS, CascaderDataSource, FORM_FIELD_IMPORTS } from '@ethlete/components';

const LEVEL_NAMES = ['Region', 'Country', 'League', 'Club', 'Team', 'Player'];

@Component({
  selector: 'app-cascader-deep-nesting-example',
  template: `
    <et-form-field>
      <et-label>Player</et-label>
      <et-cascader [formField]="playerForm.player" [dataSource]="players" placeholder="Browse players" />
      <et-hint>Past three levels, older columns collapse into the breadcrumb row</et-hint>
    </et-form-field>

    <p>Form value: {{ playerForm.player().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, CASCADER_IMPORTS, FormField, JsonPipe],
})
export class CascaderDeepNestingExampleComponent {
  protected readonly players: CascaderDataSource<string> = {
    loadChildren: (parent) => {
      const depth = parent ? parent.value.split('/').length : 0;
      const name = LEVEL_NAMES[depth] ?? '';

      return Array.from({ length: 6 }, (_, index) => ({
        value: parent ? `${parent.value}/${index}` : `${index}`,
        label: `${name} ${index + 1}`,
        isLeaf: depth === LEVEL_NAMES.length - 1,
      }));
    },
  };

  private model = signal({ player: null as string | null });

  protected playerForm = form(this.model);
}
