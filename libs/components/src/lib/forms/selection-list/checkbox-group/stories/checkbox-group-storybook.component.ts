import { JsonPipe } from '@angular/common';
import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
import { ColorInteractiveDirective, ProvideColorDirective } from '@ethlete/core';
import { DescriptionComponent } from '../../../description';
import { FormFieldSize, HintComponent, LabelDirective } from '../../../form-field';
import { SelectionListControlDirective } from '../../headless';
import { CheckboxGroupComponent } from '../checkbox-group.component';
import { CheckboxOptionComponent, CheckboxOptionVariant } from '../checkbox-option.component';

@Component({
  selector: 'et-sb-checkbox-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-checkbox-group [(mixed)]="mixedState" [formField]="demoForm.toppings" [size]="size()">
        <et-label>{{ label() }}</et-label>

        @if (groupControl()) {
          <div class="et-sb-select-all" etColorInteractive etSelectionListControl>
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
          <et-checkbox-option [value]="option.value" [variant]="variant()">
            {{ option.label }}
            @if (variant() === 'card' && option.description) {
              <et-description>{{ option.description }}</et-description>
            }
          </et-checkbox-option>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-checkbox-group>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.toppings().value() | json }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CheckboxGroupComponent,
    CheckboxOptionComponent,
    FormField,
    JsonPipe,
    ProvideColorDirective,
    HintComponent,
    LabelDirective,
    SelectionListControlDirective,
    ColorInteractiveDirective,
    DescriptionComponent,
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
        transition:
          border-color var(--et-checkbox-option-transition-duration, 150ms) ease,
          background-color var(--et-checkbox-option-transition-duration, 150ms) ease,
          transform var(--et-checkbox-option-transition-duration, 150ms) ease;

        > * {
          grid-area: 1 / 1;
          opacity: 0;
          color: var(--et-theme-color-on-primary-solid, white);
          transition: opacity var(--et-checkbox-option-transition-duration, 150ms) ease;
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

      /* hover-capable pointers only — on touch, :hover sticks after a tap */
      @media (hover: hover) {
        &:hover:not([aria-checked='true']):not([aria-checked='mixed']):not([aria-disabled='true']):not(
            [aria-readonly='true']
          )
          .et-sb-select-all-box {
          border-color: var(--et-surface-interaction-hover-solid, currentColor);
          background-color: color-mix(in srgb, var(--et-surface-interaction-solid, currentColor) 8%, transparent);
        }
      }

      &:focus-visible .et-sb-select-all-box {
        outline: 2px solid var(--et-theme-color-primary-solid);
        outline-offset: 2px;
      }

      &:active:not([aria-disabled='true']):not([aria-readonly='true']) .et-sb-select-all-box {
        transform: scale(0.92);
      }

      &[aria-disabled='true'] {
        opacity: var(--et-checkbox-option-opacity-disabled, 0.5);
        pointer-events: none;
        cursor: default;
      }

      &[aria-readonly='true'] {
        cursor: default;
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
  public value = input<string[]>([]);
  public mixed = input(false);
  public showMixedState = input(false);
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');
  public size = input<FormFieldSize>('md');
  public groupControl = input(false);
  public variant = input<CheckboxOptionVariant>('plain');
  public readonly = input(false);

  public options = input<{ value: string; label: string; description?: string }[]>([
    { value: 'cheese', label: 'Cheese', description: 'Mozzarella, and plenty of it.' },
    { value: 'pepperoni', label: 'Pepperoni', description: 'Spicy, and the house favourite.' },
    { value: 'mushrooms', label: 'Mushrooms', description: 'Chestnut, sliced thin.' },
  ]);

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ toppings: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
    required(s.toppings, { when: () => this.required(), message: 'Please select at least one' });
  });
}
