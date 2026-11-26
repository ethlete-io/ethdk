import { Injectable, SkipSelf, Optional } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Injectable({ providedIn: 'root' })
export class SortHeaderIntl {
  readonly changes: Subject<void> = new Subject<void>();
}

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export function SORT_HEADER_INTL_PROVIDER_FACTORY(parentIntl: SortHeaderIntl) {
  return parentIntl || new SortHeaderIntl();
}

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SORT_HEADER_INTL_PROVIDER = {
  provide: SortHeaderIntl,
  deps: [[new Optional(), new SkipSelf(), SortHeaderIntl]],
  useFactory: SORT_HEADER_INTL_PROVIDER_FACTORY,
};
