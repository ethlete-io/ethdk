import { JsonPipe } from '@angular/common';
import { Component, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { SelectionListDirective, SelectionOptionDirective } from '@ethlete/components';

@Component({
  selector: 'app-broadcast-card',
  template: `
    <span class="app-broadcast-card-indicator"></span>
    <span [id]="option.labelId" class="app-broadcast-card-label">{{ heading() }}</span>
    <span class="app-broadcast-card-meta">{{ meta() }}</span>
  `,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: SelectionOptionDirective, inputs: ['value', 'disabled'] }],
  host: {
    class: 'app-broadcast-card',
    '[attr.data-checked]': 'option.checked() || null',
    '[attr.data-disabled]': 'option.effectiveDisabled() || null',
  },
  styles: `
    .app-broadcast-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 12px;
      align-items: center;
      padding: 12px 16px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      cursor: pointer;
      outline: none;

      &:focus-visible {
        box-shadow: 0 0 0 2px var(--et-theme-color-primary-solid);
      }

      &[data-checked] {
        border-color: var(--et-theme-color-primary-solid);
      }

      &[data-disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .app-broadcast-card-indicator {
      grid-row: span 2;
      inline-size: 16px;
      block-size: 16px;
      border: 2px solid var(--et-surface-border-solid);
      border-radius: 50%;

      .app-broadcast-card[data-checked] & {
        border: 5px solid var(--et-theme-color-primary-solid);
      }
    }

    .app-broadcast-card-label {
      font-weight: 600;
    }

    .app-broadcast-card-meta {
      color: var(--et-surface-color-muted-solid);
      font-size: 0.875em;
    }
  `,
})
export class BroadcastCardComponent {
  protected option = inject(SelectionOptionDirective);

  public heading = input.required<string>();
  public meta = input('');
}

@Component({
  selector: 'app-broadcast-picker',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: SelectionListDirective,
      inputs: ['value', 'touched', 'disabled', 'readonly', 'invalid', 'errors', 'required', 'name', 'aria-label'],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
  host: { class: 'app-broadcast-picker' },
  styles: `
    .app-broadcast-picker {
      display: grid;
      gap: 8px;
    }
  `,
})
export class BroadcastPickerComponent {}

@Component({
  selector: 'app-radio-group-custom-card-example',
  template: `
    <app-broadcast-picker [formField]="streamForm.broadcast" aria-label="Broadcast">
      @for (broadcast of BROADCASTS; track broadcast.id) {
        <app-broadcast-card
          [value]="broadcast.id"
          [heading]="broadcast.heading"
          [meta]="broadcast.meta"
          [disabled]="broadcast.offline"
        />
      }
    </app-broadcast-picker>

    <p>Form value: {{ streamForm().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BroadcastPickerComponent, BroadcastCardComponent, FormField, JsonPipe],
})
export class RadioGroupCustomCardExampleComponent {
  protected readonly BROADCASTS = [
    { id: 'main', heading: 'Main stage', meta: 'English commentary', offline: false },
    { id: 'co-stream', heading: 'Co-stream', meta: 'German commentary', offline: false },
    { id: 'pov', heading: 'Player cam', meta: 'Offline', offline: true },
    { id: 'replay', heading: 'Replay', meta: 'Last match, from the start', offline: false },
  ];

  private model = signal<{ broadcast: string | null }>({ broadcast: 'main' });

  protected streamForm = form(this.model);
}
