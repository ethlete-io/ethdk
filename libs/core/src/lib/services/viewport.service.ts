import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  debounceTime,
  finalize,
  map,
  shareReplay,
  takeUntil,
  tap,
} from 'rxjs';
import { Memo } from '../decorators/memo';
import { Breakpoint, BuildMediaQueryOptions, injectViewportConfig } from '../providers';
import { equal } from '../utils';
import { ResizeObserverService } from './resize-observer.service';

export interface Size {
  width: number;
  height: number;
}

/** @deprecated use signal utils instead */
@Injectable({
  providedIn: 'root',
})
export class ViewportService {
  private readonly _resizeObserverService = inject(ResizeObserverService);
  private readonly _viewportConfig = injectViewportConfig();
  private readonly _breakpointObserver = inject(BreakpointObserver);

  private readonly _viewportMonitorStop$ = new Subject<void>();
  private _isViewportMonitorEnabled = false;

  private _isXs$ = new BehaviorSubject(this.isMatched({ max: 'xs' }));
  private _isSm$ = new BehaviorSubject(this.isMatched({ min: 'sm', max: 'sm' }));
  private _isMd$ = new BehaviorSubject(this.isMatched({ min: 'md', max: 'md' }));
  private _isLg$ = new BehaviorSubject(this.isMatched({ min: 'lg', max: 'lg' }));
  private _isXl$ = new BehaviorSubject(this.isMatched({ min: 'xl', max: 'xl' }));
  private _is2Xl$ = new BehaviorSubject(this.isMatched({ min: '2xl' }));

  private _viewportSize$ = new BehaviorSubject<Size | null>(null);
  private _scrollbarSize$ = new BehaviorSubject<Size | null>(null);

  get isXs$() {
    return this._isXs$.asObservable();
  }

  get isXs() {
    return this._isXs$.value;
  }

  get isSm$() {
    return this._isSm$.asObservable();
  }

  get isSm() {
    return this._isSm$.value;
  }

  get isMd$() {
    return this._isMd$.asObservable();
  }

  get isMd() {
    return this._isMd$.value;
  }

  get isLg$() {
    return this._isLg$.asObservable();
  }

  get isLg() {
    return this._isLg$.value;
  }

  get isXl$() {
    return this._isXl$.asObservable();
  }

  get isXl() {
    return this._isXl$.value;
  }

  get is2Xl$() {
    return this._is2Xl$.asObservable();
  }

  get is2Xl() {
    return this._is2Xl$.value;
  }

  get viewportSize$() {
    return this._viewportSize$.asObservable();
  }

  get viewportSize() {
    return this._viewportSize$.value;
  }

  get scrollbarSize$() {
    return this._scrollbarSize$.asObservable();
  }

  get scrollbarSize() {
    return this._scrollbarSize$.value;
  }

  currentViewport$ = combineLatest([this.isXs$, this.isSm$, this.isMd$, this.isLg$, this.isXl$, this.is2Xl$]).pipe(
    map((val) => this.getCurrentViewport(val)),
    debounceTime(0),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  get currentViewport() {
    return this.getCurrentViewport([this.isXs, this.isSm, this.isMd, this.isLg, this.isXl, this.is2Xl]);
  }

  constructor() {
    this._observeDefaultBreakpoints();
  }

  observe(options: { min?: number | Breakpoint; max?: number | Breakpoint }): Observable<boolean> {
    const mediaQuery = this._buildMediaQuery(options);

    return this._breakpointObserver.observe(mediaQuery).pipe(
      map((x) => x.matches),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  isMatched(options: { min?: number | Breakpoint; max?: number | Breakpoint }): boolean {
    const mediaQuery = this._buildMediaQuery(options);

    return this._breakpointObserver.isMatched(mediaQuery);
  }

  /**
   * Applies size CSS variables to the documentElement in pixels.
   * - `--et-vw`: viewport width excluding scrollbar width
   * - `--et-vh`: viewport height excluding scrollbar height
   * - `--et-sw`: scrollbar width
   * - `--et-sh`: scrollbar height
   */
  monitorViewport() {
    if (this._isViewportMonitorEnabled) return;

    this._isViewportMonitorEnabled = true;

    this._resizeObserverService
      .observe(document.documentElement)
      .pipe(
        tap((e) => {
          const entry = e[0];

          if (!entry) return;

          const width = entry.contentRect.width;
          const height = entry.contentRect.height;

          const obj = { width, height };

          if (equal(obj, this._viewportSize$.value)) return;

          document.documentElement.style.setProperty('--et-vw', `${obj.width}px`);
          document.documentElement.style.setProperty('--et-vh', `${obj.height}px`);

          this._viewportSize$.next(obj);
        }),
        finalize(() => {
          document.documentElement.style.removeProperty('--et-vw');
          document.documentElement.style.removeProperty('--et-vh');

          this._viewportSize$.next(null);
        }),
        takeUntil(this._viewportMonitorStop$),
      )
      .subscribe();

    const scrollbarRuler = document.createElement('div');
    scrollbarRuler.style.width = '100px';
    scrollbarRuler.style.height = '100px';
    scrollbarRuler.style.overflow = 'scroll';
    scrollbarRuler.style.position = 'absolute';
    scrollbarRuler.style.top = '-9999px';
    document.body.appendChild(scrollbarRuler);

    this._resizeObserverService
      .observe(scrollbarRuler)
      .pipe(
        tap((e) => {
          const entry = e[0];

          if (!entry) return;

          const size = entry.contentRect.width;

          const obj = { width: 100 - size, height: 100 - size };

          if (equal(obj, this._scrollbarSize$.value)) return;

          document.documentElement.style.setProperty('--et-sw', `${obj.width}px`);
          document.documentElement.style.setProperty('--et-sh', `${obj.height}px`);

          this._scrollbarSize$.next(obj);
        }),
        finalize(() => {
          document.body.removeChild(scrollbarRuler);
          document.documentElement.style.removeProperty('--et-vw');
          document.documentElement.style.removeProperty('--et-vh');

          this._scrollbarSize$.next(null);
        }),
        takeUntil(this._viewportMonitorStop$),
      )
      .subscribe();
  }

  unmonitorViewport() {
    this._viewportMonitorStop$.next();
    this._isViewportMonitorEnabled = false;
  }

  @Memo()
  getBreakpointSize(type: Breakpoint, option: 'min' | 'max') {
    const index = option === 'min' ? 0 : 1;
    const size = this._viewportConfig.breakpoints[type][index];

    if (size === Infinity || size === 0) {
      return size;
    }

    if (option === 'min') {
      return size;
    }

    // Due to scaling, the actual size of the viewport may be a decimal number.
    // Eg. on Windows 11 with 150% scaling, the viewport size may be 1535.33px
    // and thus not matching any of the default breakpoints.
    return size + 0.9;
  }

  private _observeDefaultBreakpoints() {
    this.observe({ max: 'xs' }).subscribe(this._isXs$);
    this.observe({ min: 'sm', max: 'sm' }).subscribe(this._isSm$);
    this.observe({ min: 'md', max: 'md' }).subscribe(this._isMd$);
    this.observe({ min: 'lg', max: 'lg' }).subscribe(this._isLg$);
    this.observe({ min: 'xl', max: 'xl' }).subscribe(this._isXl$);
    this.observe({ min: '2xl' }).subscribe(this._is2Xl$);
  }

  @Memo({
    resolver: (v: BuildMediaQueryOptions) => {
      return `${v.min ?? ''}-${v.max ?? ''}`;
    },
  })
  private _buildMediaQuery(options: BuildMediaQueryOptions) {
    if (!options.min && !options.max) {
      throw new Error('At least one of min or max must be defined');
    }

    const mediaQueryParts: string[] = [];

    if (options.min) {
      if (typeof options.min === 'number') {
        mediaQueryParts.push(`(min-width: ${options.min}px)`);
      } else {
        mediaQueryParts.push(`(min-width: ${this.getBreakpointSize(options.min, 'min')}px)`);
      }
    }

    if (options.min && options.max) {
      mediaQueryParts.push('and');
    }

    if (options.max) {
      if (typeof options.max === 'number') {
        mediaQueryParts.push(`(max-width: ${options.max}px)`);
      } else {
        mediaQueryParts.push(`(max-width: ${this.getBreakpointSize(options.max, 'max')}px)`);
      }
    }

    return mediaQueryParts.join(' ');
  }

  private getCurrentViewport([isXs, isSm, isMd, isLg, isXl, is2Xl]: [
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
  ]): Breakpoint {
    if (isXs) {
      return 'xs';
    } else if (isSm) {
      return 'sm';
    } else if (isMd) {
      return 'md';
    } else if (isLg) {
      return 'lg';
    } else if (isXl) {
      return 'xl';
    } else if (is2Xl) {
      return '2xl';
    }

    return 'xs';
  }
}
