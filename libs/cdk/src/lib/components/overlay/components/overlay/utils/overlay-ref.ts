import { FocusOrigin } from '@angular/cdk/a11y';
import { DialogRef as CdkDialogRef } from '@angular/cdk/dialog';
import { ESCAPE, hasModifierKey } from '@angular/cdk/keycodes';
import { GlobalPositionStrategy } from '@angular/cdk/overlay';
import { ComponentRef } from '@angular/core';
import { Observable, Subject, filter, merge, skipUntil, take } from 'rxjs';
import { OverlayContainerComponent } from '../components';
import { OVERLAY_STATE, OverlayConfig, OverlayPosition, OverlayState } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class OverlayRef<T = any, R = any> {
  componentInstance: T | null = null;
  readonly componentRef: ComponentRef<T> | null = null;
  disableClose: boolean | undefined;

  id: string;

  private readonly _afterOpened = new Subject<void>();
  private readonly _beforeClosed = new Subject<R | undefined>();
  private readonly _closeCalled = new Subject<R | undefined>();

  private _result: R | undefined;
  private _state: OverlayState = OVERLAY_STATE.OPEN;

  _closeInteractionType: FocusOrigin | undefined;
  _isEscCloseControlledExternally = false;
  _isBackdropCloseControlledExternally = false;
  _isCloseFnCloseControlledExternally = false;

  private _disableCloseFromInternalInitiators = new Set<string | number>();

  get _internalDisableClose() {
    return this._disableCloseFromInternalInitiators.size > 0;
  }

  get _cdkRef() {
    return this._ref;
  }

  constructor(
    private _ref: CdkDialogRef<R, T>,
    config: OverlayConfig,
    public _containerInstance: OverlayContainerComponent,
  ) {
    this.disableClose = config.disableClose;
    this.id = _ref.id;

    _containerInstance._animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'entered'),
        take(1),
      )
      .subscribe(() => {
        this._afterOpened.next();
        this._afterOpened.complete();
      });

    _containerInstance._animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'left'),
        take(1),
      )
      .subscribe(() => {
        this._finishOverlayClose();
      });

    _ref.overlayRef.detachments().subscribe(() => {
      this._beforeClosed.next(this._result);
      this._beforeClosed.complete();
      this._finishOverlayClose();
    });

    merge(
      this.backdropClick(),
      this.keydownEvents().pipe(
        filter((event) => event.keyCode === ESCAPE && !this.disableClose && !hasModifierKey(event)),
      ),
    )
      .pipe(skipUntil(_containerInstance._animatedLifecycle.state$.pipe(filter((e) => e === 'entering'))))
      .subscribe((event) => {
        if (
          (this._isEscCloseControlledExternally && event.type === 'keydown') ||
          (this._isBackdropCloseControlledExternally && event.type !== 'keydown')
        ) {
          return;
        }

        if (!this.disableClose && !this._internalDisableClose) {
          event.preventDefault();
          this._closeOverlayVia(event.type === 'keydown' ? 'keyboard' : 'mouse', undefined, true);
        }
      });
  }

  close(result?: R, force?: boolean): void {
    if (this._state === OVERLAY_STATE.CLOSING || this._state === OVERLAY_STATE.CLOSED) {
      return;
    }

    this._closeCalled.next(result);

    if (this._isCloseFnCloseControlledExternally && !force) {
      return;
    }

    this._result = result;

    this._containerInstance._animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'leaving'),
        take(1),
      )
      .subscribe(() => {
        this._beforeClosed.next(result);
        this._beforeClosed.complete();
        this._ref.overlayRef.detachBackdrop();
      });

    this._containerInstance._animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'left'),
        take(1),
      )
      .subscribe(() => this._finishOverlayClose());

    this._state = OVERLAY_STATE.CLOSING;
    this._containerInstance._animatedLifecycle.leave();
  }

  afterOpened(): Observable<void> {
    return this._afterOpened;
  }

  afterClosed(): Observable<R | undefined> {
    return this._ref.closed;
  }

  beforeClosed(): Observable<R | undefined> {
    return this._beforeClosed;
  }

  backdropClick(): Observable<MouseEvent> {
    return this._ref.backdropClick;
  }

  keydownEvents(): Observable<KeyboardEvent> {
    return this._ref.keydownEvents;
  }

  closeCalled(): Observable<R | undefined> {
    return this._closeCalled;
  }

  updatePosition(position?: OverlayPosition): this {
    const strategy = this._ref.config.positionStrategy as GlobalPositionStrategy;

    if (position && (position.left || position.right)) {
      position.left ? strategy.left(position.left) : strategy.right(position.right);
    } else {
      strategy.centerHorizontally();
    }

    if (position && (position.top || position.bottom)) {
      position.top ? strategy.top(position.top) : strategy.bottom(position.bottom);
    } else {
      strategy.centerVertically();
    }

    this._ref.updatePosition();

    return this;
  }

  updateSize(width = '', height = ''): this {
    this._ref.updateSize(width, height);
    return this;
  }

  addPanelClass(classes: string | string[]): this {
    this._ref.addPanelClass(classes);
    return this;
  }

  removePanelClass(classes: string | string[]): this {
    this._ref.removePanelClass(classes);
    return this;
  }

  getState(): OverlayState {
    return this._state;
  }

  private _finishOverlayClose() {
    this._state = OVERLAY_STATE.CLOSED;
    this._ref.close(this._result, { focusOrigin: this._closeInteractionType });
    this.componentInstance = null;
  }

  _closeOverlayVia(interactionType: FocusOrigin, result?: R, force?: boolean) {
    this._closeInteractionType = interactionType;
    return this.close(result, force);
  }

  _addInternalBackdropCloseInitiator(initiatorId: string | number) {
    if (this.disableClose) return;

    this._disableCloseFromInternalInitiators.add(initiatorId);
  }

  _removeInternalBackdropCloseInitiator(initiatorId: string | number) {
    if (this.disableClose) return;

    this._disableCloseFromInternalInitiators.delete(initiatorId);
  }
}
