import { DestroyRef, Directive, OnInit, afterNextRender, inject, input } from '@angular/core';
import { outputToObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RuntimeError } from '@ethlete/core';
import { tap } from 'rxjs';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectOptionsFromQuery } from '../select-options-from-query';
import { SelectDirective } from './select.directive';

/**
 * Wires an async options bundle - the return value of `selectOptionsFromQuery` or
 * `selectOptionsFromV2Query` - into a select with a single binding, replacing the manual
 * per-input wiring. Push the bundle in and it forwards `loading`, `error` and `hasMoreItems`,
 * forces `filterMode` to `external`, and drives the bundle's `setQuery`/`loadMore` from the
 * select's `(queryChange)`/`(loadMore)` outputs. Render `options` yourself as before:
 *
 * ```html
 * <et-select [formField]="form.assignee" [etSelectOptions]="users">
 *   <input etSelectSearch placeholder="Search users" />
 *   @for (user of users.options(); track user.id) {
 *     <et-select-option [value]="user.id">{{ user.name }}</et-select-option>
 *   }
 * </et-select>
 * ```
 *
 * Both flavors return the same bundle shape, so one directive serves the current query client and
 * the legacy `V2QueryClient` alike.
 */
@Directive({
  selector: '[etSelectOptions]',
  exportAs: 'etSelectOptions',
})
export class SelectOptionsDirective implements OnInit {
  private select = inject(SelectDirective, { optional: true });
  private destroyRef = inject(DestroyRef);

  /** The bundle from `selectOptionsFromQuery` / `selectOptionsFromV2Query`. */
  public bundle = input.required<SelectOptionsFromQuery<unknown>>({ alias: 'etSelectOptions' });

  constructor() {
    const select = this.select;

    if (select) {
      this.destroyRef.onDestroy(() => select.asyncOptions.set(null));

      // Replaces (queryChange)="bundle.setQuery($event)" / (loadMore)="bundle.loadMore()".
      outputToObservable(select.queryChange)
        .pipe(
          tap((query) => this.bundle().setQuery(query)),
          takeUntilDestroyed(),
        )
        .subscribe();
      outputToObservable(select.loadMore)
        .pipe(
          tap(() => this.bundle().loadMore()),
          takeUntilDestroyed(),
        )
        .subscribe();
    }

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.OPTIONS_OUTSIDE_SELECT,
            '[SelectOptionsDirective] etSelectOptions must be placed on an [etSelect] / et-select element.',
          );
        }
      });
    }
  }

  public ngOnInit() {
    // The factory bundle is created once (a field initializer), so a one-time push is enough -
    // it overrides loading/error/hasMoreItems and forces filterMode to external while set.
    this.select?.asyncOptions.set(this.bundle());
  }
}
