/* eslint-disable @angular-eslint/directive-class-suffix */

import { Directive, inject, Injectable, InjectionToken, isDevMode, NgZone, OnDestroy } from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { throwMissingMenuReference, throwMissingPointerFocusTracker } from './menu-errors';
import { Menu } from './menu-interface';
import { FocusableElement, PointerFocusTracker } from './pointer-focus-tracker';

export interface MenuAim {
  initialize(menu: Menu, pointerTracker: PointerFocusTracker<FocusableElement & Toggler>): void;

  toggle(doToggle: () => void): void;
}

export const MENU_AIM = new InjectionToken<MenuAim>('cdk-menu-aim');

const MOUSE_MOVE_SAMPLE_FREQUENCY = 3;

const NUM_POINTS = 5;

const CLOSE_DELAY = 300;

export interface Toggler {
  getMenu(): Menu | undefined;
}

function getSlope(a: Point, b: Point) {
  return (b.y - a.y) / (b.x - a.x);
}

function getYIntercept(point: Point, slope: number) {
  return point.y - slope * point.x;
}

type Point = { x: number; y: number };

function isWithinSubmenu(submenuPoints: DOMRect, m: number, b: number) {
  const { left, right, top, bottom } = submenuPoints;

  return (
    (m * left + b >= top && m * left + b <= bottom) ||
    (m * right + b >= top && m * right + b <= bottom) ||
    ((top - b) / m >= left && (top - b) / m <= right) ||
    ((bottom - b) / m >= left && (bottom - b) / m <= right)
  );
}

@Injectable()
export class TargetMenuAim implements MenuAim, OnDestroy {
  private readonly _ngZone = inject(NgZone);

  private readonly _points: Point[] = [];

  private _menu: Menu | null = null;

  private _pointerTracker: PointerFocusTracker<Toggler & FocusableElement> | null = null;

  private _timeoutId: number | null = null;

  private readonly _destroyed: Subject<void> = new Subject();

  ngOnDestroy() {
    this._destroyed.next();
    this._destroyed.complete();
  }

  initialize(menu: Menu, pointerTracker: PointerFocusTracker<FocusableElement & Toggler>) {
    this._menu = menu;
    this._pointerTracker = pointerTracker;
    this._subscribeToMouseMoves();
  }

  toggle(doToggle: () => void) {
    if (!this._menu) return;

    if (this._menu.orientation === 'horizontal') {
      doToggle();
    }

    this._checkConfigured();

    const siblingItemIsWaiting = !!this._timeoutId;
    const hasPoints = this._points.length > 1;

    if (hasPoints && !siblingItemIsWaiting) {
      if (this._isMovingToSubmenu()) {
        this._startTimeout(doToggle);
      } else {
        doToggle();
      }
    } else if (!siblingItemIsWaiting) {
      doToggle();
    }
  }

  private _startTimeout(doToggle: () => void) {
    const timeoutId = window.setTimeout(() => {
      if (!this._pointerTracker) return;

      if (this._pointerTracker.activeElement && timeoutId === this._timeoutId) {
        doToggle();
      }
      this._timeoutId = null;
    }, CLOSE_DELAY);

    this._timeoutId = timeoutId;
  }

  private _isMovingToSubmenu() {
    const submenuPoints = this._getSubmenuBounds();
    if (!submenuPoints) {
      return false;
    }

    let numMoving = 0;
    const currPoint = this._points[this._points.length - 1];

    for (let i = this._points.length - 2; i >= 0; i--) {
      const previous = this._points[i];
      const slope = getSlope(currPoint!, previous!);
      if (isWithinSubmenu(submenuPoints, slope, getYIntercept(currPoint!, slope))) {
        numMoving++;
      }
    }
    return numMoving >= Math.floor(NUM_POINTS / 2);
  }

  private _getSubmenuBounds(): DOMRect | undefined {
    return this._pointerTracker?.previousElement?.getMenu()?.nativeElement.getBoundingClientRect();
  }

  private _checkConfigured() {
    if (isDevMode()) {
      if (!this._pointerTracker) {
        throwMissingPointerFocusTracker();
      }
      if (!this._menu) {
        throwMissingMenuReference();
      }
    }
  }

  private _subscribeToMouseMoves() {
    this._ngZone.runOutsideAngular(() => {
      if (!this._menu) return;

      fromEvent<MouseEvent>(this._menu.nativeElement, 'mousemove')
        .pipe(
          filter((_: MouseEvent, index: number) => index % MOUSE_MOVE_SAMPLE_FREQUENCY === 0),
          takeUntil(this._destroyed),
        )
        .subscribe((event: MouseEvent) => {
          this._points.push({ x: event.clientX, y: event.clientY });
          if (this._points.length > NUM_POINTS) {
            this._points.shift();
          }
        });
    });
  }
}

@Directive({
  selector: '[cdkTargetMenuAim]',
  exportAs: 'cdkTargetMenuAim',
  standalone: true,
  providers: [{ provide: MENU_AIM, useClass: TargetMenuAim }],
})
export class CdkTargetMenuAim {}
