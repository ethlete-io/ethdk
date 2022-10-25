import { AsyncPipe, JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PaginationModule, SkeletonModule, SortModule, TableModule } from '@ethlete/components';
import { LetDirective, RepeatDirective } from '@ethlete/core';
import { QueryDirective, QueryForm, QueryField, transformToStringArray } from '@tomtomb/query-angular';
import { Subject, takeUntil } from 'rxjs';
import { discoverMovies } from './async-table.queries';

@Component({
  selector: 'ethlete-async-table',
  templateUrl: './async-table.component.html',
  styleUrls: ['./async-table.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    TableModule,
    SortModule,
    QueryDirective,
    AsyncPipe,
    JsonPipe,
    NgIf,
    ReactiveFormsModule,
    SkeletonModule,
    RepeatDirective,
    LetDirective,
    PaginationModule,
  ],
})
export class AsyncTableComponent implements OnInit, OnDestroy {
  discoverMoviesQuery$ = discoverMovies.behaviorSubject();

  queryForm = new QueryForm({
    with_keywords: new QueryField({
      control: new FormControl(),
      debounce: 300,
    }),
    'vote_average.gte': new QueryField({
      control: new FormControl(7),
      debounce: 300,
    }),
    page: new QueryField({
      control: new FormControl(1),
    }),
    sort_by: new QueryField({
      control: new FormControl(),
      queryParamTransformFn: transformToStringArray,
    }),
  });

  private _destroy$ = new Subject<boolean>();

  ngOnInit(): void {
    setTimeout(() => {
      this.queryForm.setFormValueFromUrlQueryParams();

      this.queryForm
        .observe({ syncViaUrlQueryParams: true })
        .pipe(takeUntil(this._destroy$))
        .subscribe((value) =>
          this.discoverMoviesQuery$.next(
            discoverMovies
              .prepare({
                queryParams: {
                  page: value.page ?? 1,
                  'vote_average.gte': value['vote_average.gte'] ?? undefined,
                  sort_by: value.sort_by,
                  with_keywords: value.with_keywords,
                },
              })
              .execute(),
          ),
        );

      this.queryForm.updateFormOnUrlQueryParamsChange().pipe(takeUntil(this._destroy$)).subscribe();
    }, 1);
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }
}
