import { AsyncPipe, JsonPipe, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { PaginationModule, SkeletonModule, Sort, SortDirection, SortModule, TableModule } from '@ethlete/components';
import { LetDirective, RepeatDirective } from '@ethlete/core';
import { QueryDirective, createReactiveQuery, FieldControlsOf } from '@tomtomb/query-angular';
import { Subject, takeUntil, takeWhile } from 'rxjs';
import { discoverMovies } from './async-table.queries';

const filterFormFields = {
  with_keywords: {
    control: new FormControl(),
    debounce: 300,
  },
  'vote_average.gte': {
    control: new FormControl(7),
    debounce: 300,
  },
  page: {
    control: new FormControl(1),
  },
  sort_by: {
    control: new FormControl(),
    serialize: serializeSortBy(),
    deserialize: deserializeSortBy(),
  },
};

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

  form?: FormGroup<FieldControlsOf<typeof filterFormFields>>;

  private _destroy$ = new Subject<boolean>();

  constructor(private _router: Router, private _activatedRoute: ActivatedRoute, private _cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this._router.events.pipe(takeWhile((e) => !(e instanceof NavigationEnd), true)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // TODO: Add support for fields that reset the page to 1
        const { form, changes } = createReactiveQuery({
          query: discoverMovies,
          router: this._router,
          activatedRoute: this._activatedRoute,
          fields: filterFormFields,
        });

        this.form = form;

        changes
          .pipe(takeUntil(this._destroy$))
          .subscribe((preparedQuery) => this.discoverMoviesQuery$.next(preparedQuery.execute()));

        this._cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }
}

function deserializeSortBy() {
  return (sortStr: string) => {
    if (sortStr) {
      const [active, direction] = sortStr.split('.');
      const sort: Sort = { active, direction: direction as SortDirection };
      return sort;
    }

    return null;
  };
}

function serializeSortBy() {
  return (sort: Sort) => {
    if (sort?.direction) {
      return `${sort.active}.${sort.direction}`;
    }

    return null;
  };
}
