import { Component, linkedSignal, signal, ViewEncapsulation } from '@angular/core';
import { email, FieldTree, form, FormField, minLength, required } from '@angular/forms/signals';
import { firstValueFrom, map, tap, timer } from 'rxjs';
import { BUTTON_IMPORTS } from '../../../button';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { INPUT_IMPORTS } from '../../input';
import { TEXTAREA_IMPORTS } from '../../textarea';
import { FORM_IMPORTS } from '../form.imports';

type SignupModel = {
  email: string;
  password: string;
  displayName: string;
  company: string;
  website: string;
  bio: string;
};

@Component({
  selector: 'et-sb-form-submission',
  template: `
    <div [style.max-inline-size.px]="480" class="flex flex-col gap-8 p-8 font-sans">
      <form [etForm]="signupForm" class="flex flex-col gap-8">
        <et-form-field>
          <et-label>Email</et-label>
          <et-input [formField]="signupForm.email" type="email" />
        </et-form-field>

        <et-form-field>
          <et-label>Password</et-label>
          <et-input [formField]="signupForm.password" type="password" />
          <et-hint>At least 8 characters.</et-hint>
        </et-form-field>

        <et-form-field>
          <et-label>Display name</et-label>
          <et-input [formField]="signupForm.displayName" />
        </et-form-field>

        <et-form-field>
          <et-label>Company</et-label>
          <et-input [formField]="signupForm.company" />
        </et-form-field>

        <et-form-field>
          <et-label>Website</et-label>
          <et-input [formField]="signupForm.website" />
        </et-form-field>

        <et-form-field>
          <et-label>Bio</et-label>
          <et-textarea [formField]="signupForm.bio" />
        </et-form-field>

        <button [loading]="signupForm().submitting()" et-button type="submit">Create account</button>
      </form>

      @if (savedName(); as name) {
        <p class="text-small">Saved - welcome, {{ name }}.</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_IMPORTS,
    ...FORM_FIELD_IMPORTS,
    ...INPUT_IMPORTS,
    ...TEXTAREA_IMPORTS,
    ...BUTTON_IMPORTS,
    FormField,
  ],
})
export class FormSubmissionStorybookComponent {
  protected savedName = signal<string | null>(null);

  private model = linkedSignal<SignupModel>(() => ({
    email: '',
    password: '',
    displayName: '',
    company: 'Ethlete',
    website: 'ethlete.io',
    bio: '',
  }));

  public signupForm = form(
    this.model,
    (s) => {
      required(s.email, { message: 'We need an email to reach you' });
      email(s.email, { message: 'That is not an email address' });
      required(s.password, { message: 'Pick a password' });
      minLength(s.password, 8, { message: 'Use at least 8 characters' });
      required(s.displayName, { message: 'Pick a name to show on your profile' });
      required(s.bio, { message: 'Tell us something about yourself' });
    },
    {
      submission: {
        action: (field: FieldTree<SignupModel>) => {
          this.savedName.set(null);

          return firstValueFrom(
            timer(900).pipe(
              tap(() => this.savedName.set(field().value().displayName)),
              map(() => undefined),
            ),
          );
        },
      },
    },
  );
}
