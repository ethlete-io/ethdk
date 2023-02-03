import { FocusOrigin } from '@angular/cdk/a11y';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class FormFieldStateService {
  readonly labelId$ = new BehaviorSubject<string | null>(null);
  readonly inputId$ = new BehaviorSubject<string | null>(null);
  readonly isFocusedVia$ = new BehaviorSubject<FocusOrigin | null>(null);
}
