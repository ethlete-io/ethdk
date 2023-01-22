import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type InputControlType = `et-control--${string}`;

@Injectable()
export class FormFieldStateService {
  labelId$ = new BehaviorSubject<string | null>(null);
  inputId$ = new BehaviorSubject<string | null>(null);

  controlType$ = new BehaviorSubject<InputControlType | null>(null);
}
