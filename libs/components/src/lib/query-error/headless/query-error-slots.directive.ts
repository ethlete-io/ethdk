import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { QUERY_ERROR_ERROR_CODES } from '../query-error-errors';
import { QueryErrorView } from '../query-error.types';
import { QUERY_ERROR_TOKEN } from './query-error.tokens';

/** What a slot template is handed: the error, already worked out. */
export type QueryErrorSlotContext = {
  $implicit: QueryErrorView;
  error: QueryErrorView;
};

/** Dev-mode guard: a slot outside a query error is registered with nothing and silently never renders. */
const assertInsideQueryError = (queryError: unknown, directiveName: string) => {
  if (!ngDevMode) return;

  afterNextRender(() => {
    if (!queryError) {
      throw new RuntimeError(
        QUERY_ERROR_ERROR_CODES.PART_OUTSIDE_QUERY_ERROR,
        `[${directiveName}] This template must be placed inside an [etQueryError] element ` +
          '(e.g. <et-query-error>), which is what renders it.',
      );
    }
  });
};

/**
 * Replaces the title. The error is in scope, so a title can key off the status — "You are signed out" reads
 * better for a 401 than the generic table entry does.
 *
 * @example
 * <ng-template etQueryErrorTitle let-error>
 *   {{ error.status === 401 ? 'You are signed out' : error.title }}
 * </ng-template>
 */
@Directive({ selector: 'ng-template[etQueryErrorTitle]' })
export class QueryErrorTitleDirective {
  public templateRef = inject<TemplateRef<QueryErrorSlotContext>>(TemplateRef);

  constructor() {
    const queryError = inject(QUERY_ERROR_TOKEN, { optional: true });

    queryError?.titleSlot.set(this.templateRef);
    assertInsideQueryError(queryError, 'QueryErrorTitleDirective');
  }
}

/**
 * Replaces the actions row, retry button included. For adding a "contact support" link, or for a recovery that
 * isn't a retry — the retry itself stays available as `queryError.retry()`.
 *
 * @example
 * <ng-template etQueryErrorActions>
 *   <button (click)="queryError.retry()" et-button>Try again</button>
 *   <a routerLink="/support">Contact support</a>
 * </ng-template>
 */
@Directive({ selector: 'ng-template[etQueryErrorActions]' })
export class QueryErrorActionsDirective {
  public templateRef = inject<TemplateRef<QueryErrorSlotContext>>(TemplateRef);

  constructor() {
    const queryError = inject(QUERY_ERROR_TOKEN, { optional: true });

    queryError?.actionsSlot.set(this.templateRef);
    assertInsideQueryError(queryError, 'QueryErrorActionsDirective');
  }
}
