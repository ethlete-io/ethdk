import { inject, Injectable } from '@angular/core';
import { Data, NavigationEnd, Params, Router } from '@angular/router';
import { BehaviorSubject, distinctUntilChanged, filter, map, Observable, pairwise } from 'rxjs';

export const routerDisableScrollTop = (config: { asReturnRoute?: boolean } = {}) => {
  if (!config.asReturnRoute) {
    return {
      disableScrollTop: true,
    };
  }

  return {
    disableScrollTopAsReturnRoute: true,
  };
};

@Injectable({
  providedIn: 'root',
})
export class RouterService {
  private _isScrollTopOnNavigationEnabled = false;
  private readonly _router = inject(Router);

  private readonly _route$ = new BehaviorSubject('/');

  private readonly _state$ = new BehaviorSubject<{
    data: Data;
    pathParams: Params;
    queryParams: Params;
    title: string | undefined;
  }>({
    title: undefined,
    data: {},
    pathParams: {},
    queryParams: {},
  });

  get route$() {
    return this._route$.asObservable();
  }

  get state$() {
    return this._state$.asObservable();
  }

  constructor() {
    this._router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        distinctUntilChanged((a, b) => a.url === b.url),
        map((event) => event.url),
      )
      .subscribe(this._route$);

    this._route$
      .pipe(
        map(() => {
          let route = this._router.routerState.snapshot.root;

          while (route.firstChild) {
            route = route.firstChild;
          }

          const { data, params, queryParams, title } = route;

          return {
            data,
            pathParams: params,
            queryParams,
            title,
          };
        }),
      )
      .subscribe(this._state$);
  }

  enableScrollTopOnNavigation(config: { scrollElement?: HTMLElement } = {}) {
    if (this._isScrollTopOnNavigationEnabled) {
      return;
    }

    this._isScrollTopOnNavigationEnabled = true;

    this._state$.pipe(pairwise()).subscribe(([oldData, newData]) => {
      if (
        !(newData.data['disableScrollTopAsReturnRoute'] && oldData.data['disableScrollTop']) &&
        !newData.data['disableScrollTop']
      ) {
        (config.scrollElement ?? document.documentElement).scrollTop = 0;
      }
    });
  }

  selectQueryParam<T = string | undefined>(key: string): Observable<T> {
    return this._state$.pipe(map((state) => state.queryParams[key]));
  }

  selectPathParam<T = string | undefined>(key: string): Observable<T> {
    return this._state$.pipe(map((state) => state.pathParams[key]));
  }

  selectData<T = unknown>(key: string): Observable<T> {
    return this._state$.pipe(map((state) => state.data[key]));
  }
}
