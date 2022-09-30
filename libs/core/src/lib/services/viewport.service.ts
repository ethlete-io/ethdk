import { Inject, Injectable, Optional } from '@angular/core';
import { BehaviorSubject, map, Observable, shareReplay } from 'rxjs';
import { DEFAULT_VIEWPORT_CONFIG, VIEWPORT_CONFIG } from '../constants';
import { Breakpoint, ViewportConfig } from '../types';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Memo } from '../public-api';
import { BuildMediaQueryOptions } from './viewport.types';

@Injectable({
  providedIn: 'root',
})
export class ViewportService {
  private _viewportConfig: ViewportConfig;

  private _isXs$ = new BehaviorSubject(false);
  private _isSm$ = new BehaviorSubject(false);
  private _isMd$ = new BehaviorSubject(false);
  private _isLg$ = new BehaviorSubject(false);
  private _isXl$ = new BehaviorSubject(false);
  private _is2Xl$ = new BehaviorSubject(false);

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

  constructor(
    @Inject(VIEWPORT_CONFIG) @Optional() _viewportConfig: ViewportConfig | null,
    private _breakpointObserver: BreakpointObserver,
  ) {
    this._viewportConfig = _viewportConfig || DEFAULT_VIEWPORT_CONFIG;
    this._observeDefaultBreakpoints();
  }

  observe(options: { min?: number | Breakpoint; max?: number | Breakpoint }): Observable<boolean> {
    const mediaQuery = this._buildMediaQuery(options);

    return this._breakpointObserver.observe(mediaQuery).pipe(
      map((x) => x.matches),
      shareReplay(),
    );
  }

  isMatched(options: { min?: number | Breakpoint; max?: number | Breakpoint }): boolean {
    const mediaQuery = this._buildMediaQuery(options);

    return this._breakpointObserver.isMatched(mediaQuery);
  }

  private _observeDefaultBreakpoints() {
    this.observe({ max: 'xs' }).subscribe(this._isXs$);
    this.observe({ min: 'sm', max: 'sm' }).subscribe(this._isSm$);
    this.observe({ min: 'md', max: 'md' }).subscribe(this._isMd$);
    this.observe({ min: 'lg', max: 'lg' }).subscribe(this._isLg$);
    this.observe({ min: 'xl', max: 'xl' }).subscribe(this._isXl$);
    this.observe({ min: '2xl' }).subscribe(this._is2Xl$);
  }

  @Memo()
  private _getViewportSize(type: Breakpoint, option: 'min' | 'max') {
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
    return size + 0.9999;
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
        mediaQueryParts.push(`(min-width: ${this._getViewportSize(options.min, 'min')}px)`);
      }
    }

    if (options.min && options.max) {
      mediaQueryParts.push('and');
    }

    if (options.max) {
      if (typeof options.max === 'number') {
        mediaQueryParts.push(`(max-width: ${options.max}px)`);
      } else {
        mediaQueryParts.push(`(max-width: ${this._getViewportSize(options.max, 'max')}px)`);
      }
    }

    return mediaQueryParts.join(' ');
  }
}
