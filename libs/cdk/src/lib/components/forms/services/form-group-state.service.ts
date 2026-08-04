import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Injectable()
export class FormGroupStateService {
  readonly labelId$ = new BehaviorSubject<string | null>(null);
  readonly inputIds$ = new BehaviorSubject<string[] | null>(null);
  readonly errorId$ = new BehaviorSubject<string | null>(null);

  // This will get more complex once hints are added
  readonly describedBy$ = combineLatest([this.errorId$]).pipe(
    map((ids) => {
      const idList = ids.filter((id) => !!id).join(' ');

      return idList || null;
    }),
  );
}
