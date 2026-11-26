import { Component, input, linkedSignal, signal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { CHOICE_FIELD_IMPORTS, ChoiceFieldVariant } from '../../choice-field';
import { CHECKBOX_IMPORTS } from '../checkbox.imports';

@Component({
  selector: 'et-sb-form-field-checkbox',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-choice-field [variant]="variant()">
        <et-checkbox [(indeterminate)]="indeterminateState" [formField]="demoForm.acceptTerms" />
        @if (interactiveContent()) {
          <et-label>I accept the <a (click)="termsOpened.set(true)" href="#terms">terms and conditions</a></et-label>
        } @else {
          <et-label>I accept the terms and conditions</et-label>
        }
        @if (interactiveContent()) {
          <button (click)="detailsOpened.set(true)" type="button" etSelectionCardTrailing>Details</button>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-choice-field>

      <et-choice-field [variant]="variant()">
        <et-checkbox [formField]="demoForm.acceptTermsChecked" />
        <et-label>Send me product updates</et-label>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-choice-field>

      @if (interactiveContent()) {
        <p>Terms opened: {{ termsOpened() }}, details opened: {{ detailsOpened() }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS, FormField, ProvideColorDirective],
})
export class FormFieldCheckboxStorybookComponent {
  public color = input('brand');
  public hint = input('');
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public indeterminate = input(false);
  public variant = input<ChoiceFieldVariant>('plain');
  public interactiveContent = input(false);

  public termsOpened = signal(false);
  public detailsOpened = signal(false);

  public indeterminateState = linkedSignal(() => this.indeterminate());

  private formModel = linkedSignal(() => ({
    acceptTerms: false,
    acceptTermsChecked: true,
  }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
    required(s.acceptTerms, { when: () => this.required(), message: 'You must accept the terms' });
    required(s.acceptTermsChecked, { when: () => this.required(), message: 'You must accept the terms' });
  });
}
