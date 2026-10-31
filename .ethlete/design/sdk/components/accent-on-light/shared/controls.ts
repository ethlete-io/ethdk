import { ng } from '@design-system';

export const controls = () =>
  ng(
    `<div class="accent-on-light et-color--brand">
      <div class="accent-on-light-row">
        <et-checkbox [formField]="fields.checked" aria-label="Checked" />
        <et-checkbox [formField]="fields.mixed" [indeterminate]="true" aria-label="Mixed" />
        <et-checkbox [formField]="fields.unchecked" aria-label="Unchecked" />
        <et-switch [formField]="fields.on" aria-label="On" />
      </div>
      <et-radio-group [formField]="fields.plan">
        <et-label>Plan</et-label>
        <et-radio value="free">Free</et-radio>
        <et-radio value="pro">Pro</et-radio>
      </et-radio-group>
      <et-segmented-button-group [formField]="fields.view">
        <et-label>View</et-label>
        <et-segmented-button value="list">List</et-segmented-button>
        <et-segmented-button value="grid">Grid</et-segmented-button>
      </et-segmented-button-group>
      <et-choice-field variant="card">
        <et-checkbox [formField]="fields.digest" />
        <et-label>Weekly digest</et-label>
      </et-choice-field>
    </div>`,
    {
      imports: [
        'CHECKBOX_IMPORTS',
        'SWITCH_IMPORTS',
        'RADIO_GROUP_IMPORTS',
        'SEGMENTED_BUTTON_IMPORTS',
        'CHOICE_FIELD_IMPORTS',
        'FORM_FIELD_IMPORTS',
      ],
      fields: {
        checked: { value: true },
        mixed: { value: false },
        unchecked: { value: false },
        on: { value: true },
        plan: { value: 'pro' },
        view: { value: 'list' },
        digest: { value: true },
      },
    },
  );
