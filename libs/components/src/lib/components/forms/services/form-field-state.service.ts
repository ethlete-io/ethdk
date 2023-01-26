import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type InputControlType = `et-control--${string}`;
export type InputControlGroupType = `et-control-group--${string}`;

@Injectable()
export class FormFieldStateService {
  labelId$ = new BehaviorSubject<string | null>(null);
  inputId$ = new BehaviorSubject<string | null>(null);

  controlType$ = new BehaviorSubject<InputControlType | null>(null);
  controlGroupType$ = new BehaviorSubject<InputControlGroupType | null>(null);
}
