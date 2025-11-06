import { inject, Injectable, signal } from '@angular/core';
import { Data, Event, NavigationEnd, Params, Router } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  pairwise,
  shareReplay,
  tap,
} from 'rxjs';
import {
  ET_DISABLE_SCROLL_TOP,
  ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE,
  ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE,
  SetupScrollRestorationConfig,
} from '../signals';
import { equal } from '../utils';

export interface RouterState {
  data: Data;
  pathParams: Params;
  queryParams: Params;
  title: string | null;
  fragment: string | null;
}

export const ET_PROPERTY_REMOVED = Symbol('ET_PROPERTY_REMOVED');

/** @deprecated use respective signal utils instead */
@Injectable({
  providedIn: 'root',
})
export class RouterStateService {
  private _isScrollTopOnNavigationEnabled = false;
  private readonly _router = inject(Router);

  private readonly _route$ = new BehaviorSubject(window.location.pathname);
  private readonly _state$ = new BehaviorSubject<RouterState>(this._getInitialState());

  private readonly _afterInitialize$ = new BehaviorSubject<boolean>(false);
  readonly afterInitialize$ = this._afterInitialize$.pipe(filter((v) => v));

  get route$() {
    return this._route$.asObservable().pipe(distinctUntilChanged());
  }

  get route() {
    return this._route$.getValue();
  }

  get state$() {
    return this._state$.asObservable();
  }

  get state() {
    return this._state$.getValue();
  }

  get data$() {
    return this._state$.pipe(
      map((state) => state.data),
      distinctUntilChanged((a, b) => equal(a, b)),
    );
  }

  get data() {
    return this._state$.getValue().data;
  }

  get pathParams$() {
    return this._state$.pipe(
      map((state) => state.pathParams),
      distinctUntilChanged((a, b) => equal(a, b)),
    );
  }

  get pathParams() {
    return this._state$.getValue().pathParams;
  }

  get queryParams$() {
    return this._state$.pipe(
      map((state) => state.queryParams),
      distinctUntilChanged((a, b) => equal(a, b)),
    );
  }

  get queryParams() {
    return this._state$.getValue().queryParams;
  }

  get title$() {
    return this._state$.pipe(
      map((state) => state.title),
      distinctUntilChanged(),
    );
  }

  get title() {
    return this._state$.getValue().title;
  }

  get fragment$() {
    return this._state$.pipe(
      map((state) => state.fragment),
      distinctUntilChanged(),
    );
  }

  get fragment() {
    return this._state$.getValue().fragment;
  }

  get dataChanges$() {
    return this.data$.pipe(
      pairwise(),
      map((v) => this._findChanges(v)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  get queryParamChanges$() {
    return this.queryParams$.pipe(
      pairwise(),
      map((v) => this._findChanges(v)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  get pathParamChanges$() {
    return this.pathParams$.pipe(
      pairwise(),
      map((v) => this._findChanges(v)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  latestEvent = signal<Event | null>(null);

  constructor() {
    this._router.events
      .pipe(
        tap((event) => this.latestEvent.set(event)),
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        distinctUntilChanged((a, b) => a.url === b.url),
        map((event) => {
          const { url } = event;

          const urlWithoutQueryParams = url.split('?')[0] ?? '';
          const withoutFragment = urlWithoutQueryParams.split('#')[0] ?? '';

          return withoutFragment;
        }),
        tap(() => {
          if (!this._afterInitialize$.getValue()) {
            this._afterInitialize$.next(true);
          }
        }),
      )
      .subscribe(this._route$);

    combineLatest([this._route$, this._afterInitialize$])
      .pipe(
        tap(([, afterInitialize]) => {
          if (!afterInitialize) return;

          let route = this._router.routerState.snapshot.root;

          while (route.firstChild) {
            route = route.firstChild;
          }

          const { data, params, queryParams, title, fragment } = route;

          this._state$.next({
            data,
            pathParams: params,
            queryParams,
            title: title ?? null,
            fragment,
          });
        }),
      )
      .subscribe();
  }

  enableScrollEnhancements(config: SetupScrollRestorationConfig = {}) {
    if (this._isScrollTopOnNavigationEnabled) {
      return;
    }

    this._isScrollTopOnNavigationEnabled = true;

    combineLatest([this._state$.pipe(pairwise()), this._route$.pipe(pairwise())])
      .pipe(debounceTime(1))
      .subscribe(([[prevState, currState], [prevRoute, currRoute]]) => {
        const sameUrlNavigation = prevRoute === currRoute;
        const didFragmentChange = prevState.fragment !== currState.fragment;

        if (sameUrlNavigation) {
          const allQueryParams = [
            ...new Set(Object.keys(prevState.queryParams).concat(Object.keys(currState.queryParams))),
          ];

          const changedQueryParams = allQueryParams.filter(
            (key) => currState.queryParams[key] !== prevState.queryParams[key],
          );

          if (!config.queryParamTriggerList?.length && !didFragmentChange) {
            return;
          }

          const caseQueryParams = changedQueryParams.some((key) => config.queryParamTriggerList?.includes(key));
          const caseFragment = didFragmentChange && config.fragment?.enabled;

          if (caseQueryParams) {
            (config.scrollElement ?? document.documentElement).scrollTop = 0;
          } else if (caseFragment) {
            const fragmentElement = document.getElementById(currState.fragment ?? '');

            if (fragmentElement) {
              fragmentElement.scrollIntoView({ behavior: config.fragment?.smooth ? 'smooth' : 'auto' });
            }
          }
        } else {
          const viaReturnRoute =
            currState.data[ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE] && prevState.data[ET_DISABLE_SCROLL_TOP];
          const explicitly = currState.data[ET_DISABLE_SCROLL_TOP];
          const pathParamsChange = currState.data[ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE];

          if (viaReturnRoute || explicitly || pathParamsChange) {
            return;
          }

          const el = config.scrollElement ?? document.documentElement;
          el.scrollTop = 0;
        }
      });
  }

  selectQueryParam<T = string | undefined>(key: string): Observable<T> {
    return this._state$.pipe(
      map((state) => state.queryParams[key]),
      distinctUntilChanged(),
    );
  }

  selectPathParam<T = string | undefined>(key: string): Observable<T> {
    return this._state$.pipe(
      map((state) => state.pathParams[key]),
      distinctUntilChanged(),
    );
  }

  selectData<T = unknown>(key: string): Observable<T> {
    return this._state$.pipe(
      map((state) => state.data[key]),
      distinctUntilChanged((a, b) => equal(a, b)),
    );
  }

  private _findChanges<T extends [Record<string, unknown>, Record<string, unknown>], J extends Partial<T[number]>>([
    previous,
    current,
  ]: T) {
    const changes: Record<string, unknown> = {};

    const allKeys = new Set<keyof typeof previous & keyof typeof current>([
      ...Object.keys(previous),
      ...Object.keys(current),
    ]);

    for (const key of allKeys) {
      if (!equal(previous[key], current[key])) {
        const val = current[key] === undefined ? ET_PROPERTY_REMOVED : current[key];

        changes[key] = val;
      }
    }

    return changes as J;
  }

  private _getInitialState(): RouterState {
    const data = {};
    const pathParams = {};
    const queryParams: Params = {};
    const title = null;
    let fragment = null;

    const currentQueryParams = window.location.search;
    const currentFragment = window.location.hash;

    if (currentQueryParams) {
      const params = new URLSearchParams(currentQueryParams);

      params.forEach((value, key) => {
        queryParams[key] = value;
      });
    }

    if (currentFragment) {
      fragment = currentFragment.slice(1);
    }

    return {
      data,
      pathParams,
      queryParams,
      title,
      fragment,
    };
  }
}
