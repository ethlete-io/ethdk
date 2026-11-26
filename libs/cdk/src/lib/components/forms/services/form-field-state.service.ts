import { FocusOrigin } from '@angular/cdk/a11y';
import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Injectable()
export class FormFieldStateService {
  readonly labelId$ = new BehaviorSubject<string | null>(null);
  readonly labelId = toSignal(this.labelId$, { requireSync: true });

  readonly inputId$ = new BehaviorSubject<string | null>(null);
  readonly inputId = toSignal(this.inputId$, { requireSync: true });

  readonly isFocusedVia$ = new BehaviorSubject<FocusOrigin | null>(null);
  readonly isFocusedVia = toSignal(this.isFocusedVia$, { requireSync: true });

  readonly errorId$ = new BehaviorSubject<string | null>(null);
  readonly errorId = toSignal(this.errorId$, { requireSync: true });

  readonly hasPrefix$ = new BehaviorSubject(false);
  readonly hasPrefix = toSignal(this.hasPrefix$, { requireSync: true });

  readonly hasSuffix$ = new BehaviorSubject(false);
  readonly hasSuffix = toSignal(this.hasSuffix$, { requireSync: true });

  // This will get more complex once hints are added
  readonly describedBy$ = combineLatest([this.errorId$]).pipe(
    map((ids) => {
      const idList = ids.filter((id) => !!id).join(' ');

      return idList || null;
    }),
  );

  readonly describedBy = toSignal(this.describedBy$, { requireSync: true });
}
