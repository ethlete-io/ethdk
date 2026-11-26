import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CHECKBOX_IMPORTS, CHOICE_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-checkbox-card-interactive-example',
  template: `
    <et-choice-field variant="card">
      <et-checkbox [formField]="termsForm.acceptTerms" />
      <et-label>I accept the <a (click)="termsOpened.set(true)" href="#terms">terms and conditions</a></et-label>
      <button (click)="detailsOpened.set(true)" type="button" etSelectionCardTrailing>Details</button>
    </et-choice-field>

    <p>Terms opened: {{ termsOpened() }}, details opened: {{ detailsOpened() }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS, FormField],
})
export class CheckboxCardInteractiveExampleComponent {
  protected termsOpened = signal(false);
  protected detailsOpened = signal(false);

  private model = signal({ acceptTerms: false });

  protected termsForm = form(this.model);
}
