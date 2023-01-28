import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class FormGroupStateService {
  labelId$ = new BehaviorSubject<string | null>(null);
  inputIds$ = new BehaviorSubject<string[] | null>(null);
}
