import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

type Team = { id: number; name: string };

const TEAMS: Team[] = [
  { id: 1, name: 'Platform' },
  { id: 2, name: 'Payments' },
  { id: 3, name: 'Growth' },
  { id: 4, name: 'Design' },
];

const compareTeamsById = (a: Team, b: Team) => a.id === b.id;

@Component({
  selector: 'app-select-object-values-example',
  template: `
    <et-form-field>
      <et-label>Teams</et-label>
      <et-select
        [formField]="teamForm.teams"
        [options]="options()"
        [compareWith]="COMPARE_TEAMS_BY_ID"
        placeholder="Pick teams"
        multiple
      />
      <et-hint>The saved value holds copies of the team objects - compareWith matches them by id</et-hint>
    </et-form-field>

    <div class="app-example-row">
      <button (click)="reloadOptions()" type="button">Reload options</button>
      <button (click)="resetToSaved()" type="button">Reset to saved</button>
    </div>

    <p>Form value: {{ teamForm.teams().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField, JsonPipe],
})
export class SelectObjectValuesExampleComponent {
  protected readonly COMPARE_TEAMS_BY_ID = compareTeamsById;
  protected options = signal(this.toOptions());

  private model = signal({ teams: this.savedTeams() });

  protected teamForm = form(this.model);

  protected reloadOptions() {
    this.options.set(this.toOptions());
  }

  protected resetToSaved() {
    this.model.set({ teams: this.savedTeams() });
  }

  private savedTeams() {
    return TEAMS.filter((team) => team.id === 1 || team.id === 3).map((team) => ({ ...team }));
  }

  private toOptions() {
    return TEAMS.map((team) => ({ value: { ...team }, label: team.name }));
  }
}
