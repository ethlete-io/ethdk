import { Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { SELECT_IMPORTS } from '../select.imports';

const GROUPS = [
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
] as const;

@Component({
  selector: 'et-sb-select-option-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-select [formField]="demoForm.value" [placeholder]="placeholder()" filterMode="internal">
          @if (withSearch()) {
            <input etSelectSearch placeholder="Search players" />
          }
          @for (group of GROUPS; track group.label) {
            <et-select-option-group [label]="group.label">
              @for (player of group.players; track player.value) {
                <et-select-option [value]="player.value">{{ player.label }}</et-select-option>
              }
            </et-select-option-group>
          }
        </et-select>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <p class="text-sm opacity-60">Form value: "{{ demoForm.value().value() ?? 'null' }}"</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...SELECT_IMPORTS, FormField, ProvideColorDirective],
})
export class SelectOptionGroupStorybookComponent {
  public label = input('Player');
  public hint = input('');
  public placeholder = input('Pick a player');
  public withSearch = input(false);
  public value = input<string | null>(null);
  public color = input('brand');

  protected readonly GROUPS = GROUPS;

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel);
}
