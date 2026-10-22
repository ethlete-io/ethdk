import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-select-option-group-example',
  template: `
    <et-form-field>
      <et-label>Player</et-label>
      <et-select [formField]="playerForm.player" placeholder="Pick a player">
        @for (group of GROUPS; track group.label) {
          <et-select-option-group [label]="group.label">
            @for (player of group.players; track player.value) {
              <et-select-option [value]="player.value">{{ player.label }}</et-select-option>
            }
          </et-select-option-group>
        }
      </et-select>
    </et-form-field>

    <p>Form value: {{ playerForm.player().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField, JsonPipe],
})
export class SelectOptionGroupExampleComponent {
  protected readonly GROUPS = [
    {
      label: 'Forwards',
      players: [
        { value: 'mbappe', label: 'Kylian Mbappé' },
        { value: 'haaland', label: 'Erling Haaland' },
        { value: 'kane', label: 'Harry Kane' },
      ],
    },
    {
      label: 'Midfielders',
      players: [
        { value: 'bellingham', label: 'Jude Bellingham' },
        { value: 'debruyne', label: 'Kevin De Bruyne' },
      ],
    },
    {
      label: 'Defenders',
      players: [
        { value: 'vandijk', label: 'Virgil van Dijk' },
        { value: 'hakimi', label: 'Achraf Hakimi' },
      ],
    },
  ];

  private model = signal({ player: null as string | null });

  protected playerForm = form(this.model);
}
