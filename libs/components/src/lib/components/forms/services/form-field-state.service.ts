import { Injectable, InjectionToken } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type InputControlType = `et-control--${string}`;
export type InputControlGroupType = `et-control-group--${string}`;

export const FORM_FIELD_STATE_SERVICE_TOKEN = new InjectionToken<FormFieldStateService>(
  'ET_FORM_FIELD_STATE_SERVICE_TOKEN',
);

export const FORM_GROUP_STATE_SERVICE_TOKEN = new InjectionToken<FormFieldStateService>(
  'ET_FORM_GROUP_STATE_SERVICE_TOKEN',
);

@Injectable()
export class FormFieldStateService {
  labelId$ = new BehaviorSubject<string | null>(null);
  inputId$ = new BehaviorSubject<string | null>(null);

  controlType$ = new BehaviorSubject<InputControlType | null>(null);
  controlGroupType$ = new BehaviorSubject<InputControlGroupType | null>(null);
}
