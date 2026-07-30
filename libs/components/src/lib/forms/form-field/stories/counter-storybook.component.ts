import { Component, input, linkedSignal, resource, ViewEncapsulation } from '@angular/core';
import { form, FormField, maxLength, required, validateAsync } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { firstValueFrom, map, timer } from 'rxjs';
import { INPUT_IMPORTS } from '../../input';
import { TAG_INPUT_IMPORTS } from '../../tag-input';
import { TEXTAREA_IMPORTS } from '../../textarea';
import { FORM_FIELD_IMPORTS } from '../form-field.imports';

/** How long the fake "checking the handle" async validator takes. */
const HANDLE_CHECK_MS = 1200;
const TAKEN_HANDLES = ['admin', 'root', 'ethlete'];

@Component({
  selector: 'et-sb-form-field-counter',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-8 p-8 font-sans">
      <!-- The limit comes from the schema's maxLength() — the counter needs no [max] at all. -->
      <et-form-field>
        <et-label>Bio</et-label>
        <et-textarea [formField]="bioForm.bio" placeholder="Tell us about yourself…" />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
        <et-counter />
      </et-form-field>

      <!-- An explicit soft limit, on a field the schema doesn't length-validate. -->
      <et-form-field>
        <et-label>Tagline</et-label>
        <et-input [formField]="bioForm.tagline" placeholder="One line about you" />
        <et-hint>Aim for something short — the limit here is advisory.</et-hint>
        <et-counter [max]="40" />
      </et-form-field>

      <!-- Array values count their elements, so the same counter works for tags. -->
      <et-form-field>
        <et-label>Tags</et-label>
        <et-tag-input [formField]="bioForm.tags" placeholder="Add a tag…" />
        <et-counter [max]="5" />
      </et-form-field>

      <!-- Pending async validator → the field's busy spinner, no wiring required. -->
      <et-form-field>
        <et-label>Handle</et-label>
        <et-input [formField]="handleForm.handle" placeholder="pick-a-handle" />
        <et-hint>Checked against the server as you type (try "admin").</et-hint>
        <et-counter [max]="20" />
      </et-form-field>

      <!-- The manual override, for work the form knows nothing about. -->
      <et-form-field [busy]="true">
        <et-label>Manually busy</et-label>
        <et-input [formField]="bioForm.tagline" />
        <et-hint>busy="true" — for a save or lookup the form knows nothing about.</et-hint>
      </et-form-field>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...INPUT_IMPORTS,
    ...TEXTAREA_IMPORTS,
    ...TAG_INPUT_IMPORTS,
    FormField,
    ProvideColorDirective,
  ],
})
export class FormFieldCounterStorybookComponent {
  public hint = input('');
  public bio = input('');
  public color = input('brand');

  private bioModel = linkedSignal(() => ({ bio: this.bio(), tagline: '', tags: [] as string[] }));

  public bioForm = form(this.bioModel, (s) => {
    maxLength(s.bio, 180, { message: 'Keep the bio under 180 characters' });
  });

  private handleModel = linkedSignal(() => ({ handle: '' }));

  public handleForm = form(this.handleModel, (s) => {
    required(s.handle, { message: 'Pick a handle' });

    validateAsync(s.handle, {
      params: ({ value }) => value().trim().toLowerCase() || undefined,
      debounce: 300,
      // stands in for a server round-trip, so the field's busy spinner is visible for a real interval
      factory: (params) =>
        resource({
          params: () => params(),
          loader: ({ params: handle }) =>
            firstValueFrom(timer(HANDLE_CHECK_MS).pipe(map(() => TAKEN_HANDLES.includes(handle)))),
        }),
      onSuccess: (isTaken) => (isTaken ? { kind: 'handleTaken', message: 'That handle is already taken' } : null),
      onError: () => null,
    });
  });
}
