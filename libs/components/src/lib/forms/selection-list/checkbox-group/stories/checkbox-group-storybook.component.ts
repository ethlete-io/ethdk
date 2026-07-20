import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FormFieldSize, HintComponent, LabelDirective } from '../../../form-field';
import { SelectionListControlDirective } from '../../headless';
import { CheckboxGroupComponent } from '../checkbox-group.component';
import { CheckboxOptionComponent } from '../checkbox-option.component';

@Component({
  selector: 'et-sb-checkbox-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-checkbox-group [formField]="demoForm.toppings" [size]="size()">
        <et-label>{{ label() }}</et-label>

        @if (groupControl()) {
          <div class="et-sb-select-all" etSelectionListControl>
            <span class="et-sb-select-all-box">
              <svg class="et-sb-select-all-check" viewBox="0 0 12 10" fill="none">
                <path
                  d="M1 5L4.5 8.5L11 1.5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span class="et-sb-select-all-dash"></span>
            </span>
            <span class="et-sb-select-all-label">Select all</span>
          </div>
        }

        @for (option of options(); track option.value) {
          <et-checkbox-option [value]="option.value">{{ option.label }}</et-checkbox-option>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-checkbox-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CheckboxGroupComponent,
    CheckboxOptionComponent,
    FormField,
    ProvideColorDirective,
    HintComponent,
    LabelDirective,
    SelectionListControlDirective,
  ],
  styles: `
    /* story-only styling for the headless select-all control, mirroring the option look */
    .et-sb-select-all {
      display: flex;
      align-items: center;
      gap: var(--et-checkbox-option-gap, 10px);
      cursor: pointer;
      user-select: none;
      outline: none;

      .et-sb-select-all-box {
        display: grid;
        place-items: center;
        inline-size: var(--et-checkbox-option-size, 20px);
        block-size: var(--et-checkbox-option-size, 20px);
        border-radius: var(--et-checkbox-option-border-radius, 4px);
        border: var(--et-checkbox-option-border-width, 2px) solid var(--et-surface-border-solid, currentColor);

        > * {
          grid-area: 1 / 1;
          opacity: 0;
          color: var(--et-theme-color-on-primary-solid, white);
        }
      }

      .et-sb-select-all-check {
        inline-size: 12px;
        block-size: 10px;
      }

      .et-sb-select-all-dash {
        inline-size: 10px;
        block-size: 2px;
        border-radius: 1px;
        background-color: var(--et-theme-color-on-primary-solid, white);
      }

      .et-sb-select-all-label {
        font-size: 14px;
        line-height: 20px;
        color: var(--et-surface-color-solid, currentColor);
      }

      &:focus-visible .et-sb-select-all-box {
        outline: 2px solid var(--et-theme-color-primary-solid);
        outline-offset: 2px;
      }

      &[aria-checked='true'],
      &[aria-checked='mixed'] {
        .et-sb-select-all-box {
          background-color: var(--et-theme-color-primary-solid, currentColor);
          border-color: var(--et-theme-color-primary-solid, currentColor);
        }
      }

      &[aria-checked='true'] .et-sb-select-all-check {
        opacity: 1;
      }

      &[aria-checked='mixed'] .et-sb-select-all-dash {
        opacity: 1;
      }
    }
  `,
})
export class CheckboxGroupStorybookComponent {
  public label = input('Select toppings');
  public hint = input('');
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');
  public size = input<FormFieldSize>('md');
  public groupControl = input(false);

  public options = input([
    { value: 'cheese', label: 'Cheese' },
    { value: 'pepperoni', label: 'Pepperoni' },
    { value: 'mushrooms', label: 'Mushrooms' },
  ]);

  private formModel = linkedSignal(() => ({ toppings: [] as string[] }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.toppings, { when: () => this.required(), message: 'Please select at least one' });
  });
}
