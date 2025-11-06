import { Injectable, SkipSelf, Optional } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SortHeaderIntl {
  readonly changes: Subject<void> = new Subject<void>();
}

export function SORT_HEADER_INTL_PROVIDER_FACTORY(parentIntl: SortHeaderIntl) {
  return parentIntl || new SortHeaderIntl();
}

export const SORT_HEADER_INTL_PROVIDER = {
  provide: SortHeaderIntl,
  deps: [[new Optional(), new SkipSelf(), SortHeaderIntl]],
  useFactory: SORT_HEADER_INTL_PROVIDER_FACTORY,
};
