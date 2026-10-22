import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DESCRIPTION_IMPORTS, FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-radio-group-card-example',
  template: `
    <et-radio-group [formField]="planForm.plan">
      <et-label>Plan</et-label>
      @for (plan of PLANS; track plan.value) {
        <et-radio [value]="plan.value" variant="card">
          {{ plan.label }}
          <et-description>{{ plan.description }}</et-description>
          <span etSelectionCardTrailing>{{ plan.price }}</span>
        </et-radio>
      }
    </et-radio-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS, DESCRIPTION_IMPORTS, FormField],
})
export class RadioGroupCardExampleComponent {
  protected readonly PLANS = [
    { value: 'solo', label: 'Solo', description: 'One seat, everything you need to ship.', price: '$9' },
    { value: 'team', label: 'Team', description: 'Everything in Solo, plus shared workspaces.', price: '$29' },
    { value: 'org', label: 'Organization', description: 'Everything in Team, plus single sign-on.', price: '$99' },
  ];

  private model = signal<{ plan: string | null }>({ plan: 'team' });

  protected planForm = form(this.model);
}
