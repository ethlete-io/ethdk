import { AfterContentInit, ContentChildren, Directive, Input, QueryList } from '@angular/core';
import { Router } from '@angular/router';
import { SortDirective } from '@ethlete/components';
import { AnyQuery, QueryCreator } from '@tomtomb/query-angular';
import { BehaviorSubject, combineLatest, startWith, switchMap, tap } from 'rxjs';

@Directive({
  selector: '[ethleteQueryHandler]',
  standalone: true,
})
export class QueryHandlerDirective implements AfterContentInit {
  @Input('ethleteQueryHandler')
  get queryToHandle(): BehaviorSubject<AnyQuery | null> {
    return this._queryToHandle;
  }
  set queryToHandle(v: BehaviorSubject<AnyQuery | null>) {
    this._queryToHandle = v;

    if (v.value) {
      this._queryCreator = v.value.clone();
    }
  }
  private _queryToHandle!: BehaviorSubject<AnyQuery | null>;

  private _queryCreator: QueryCreator<any, any, any, any> | null = null;

  @ContentChildren(SortDirective, { descendants: true })
  sortDirectives!: QueryList<SortDirective>;

  constructor(private _router: Router) {}

  ngAfterContentInit(): void {
    this.sortDirectives.changes
      .pipe(
        startWith(this.sortDirectives),
        switchMap((list: QueryList<SortDirective>) =>
          combineLatest(list.toArray().map((i) => i.sortChange.asObservable())),
        ),
        tap((sortEvents) => {
          const event = sortEvents[0];

          if (!event) {
            return;
          }

          if (!this._queryCreator) {
            if (!this._queryToHandle.value) {
              throw new Error('No query to handle');
            }

            this._queryCreator = this._queryToHandle.value.clone();
          }

          const query = this._queryCreator
            .prepare({ queryParams: event.direction ? { sort_by: `${event.active}.${event.direction}` } : {} })
            .execute() as AnyQuery;

          this._router.navigate([], {
            queryParams: event.direction ? { sort_by: `${event.active}.${event.direction}` } : { sort_by: undefined },
            queryParamsHandling: 'merge',
          });

          this.queryToHandle.next(query);
        }),
      )
      .subscribe();

    this.sortDirectives.changes
      .pipe(
        startWith(this.sortDirectives),
        tap((list: QueryList<SortDirective>) => {
          const event = list.first;

          if (!event) {
            return;
          }

          const sortByFromUrl = this._router.routerState.snapshot.root.queryParams['sort_by'];

          console.log(sortByFromUrl);

          if (sortByFromUrl) {
            const [active, direction] = sortByFromUrl.split('.');

            event.sort({ id: active, start: direction as any, disableClear: false });
          }
        }),
      )
      .subscribe();
  }
}
