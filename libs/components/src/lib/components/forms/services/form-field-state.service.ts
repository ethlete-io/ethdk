import { FocusOrigin } from '@angular/cdk/a11y';
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

@Injectable()
export class FormFieldStateService {
  readonly labelId$ = new BehaviorSubject<string | null>(null);
  readonly inputId$ = new BehaviorSubject<string | null>(null);
  readonly isFocusedVia$ = new BehaviorSubject<FocusOrigin | null>(null);
  readonly errorId$ = new BehaviorSubject<string | null>(null);

  readonly hasPrefix$ = new BehaviorSubject(false);
  readonly hasSuffix$ = new BehaviorSubject(false);

  // This will get more complex once hints are added
  readonly describedBy$ = combineLatest([this.errorId$]).pipe(
    map((ids) => {
      const idList = ids.filter((id) => !!id).join(' ');

      return idList || null;
    }),
  );
}
