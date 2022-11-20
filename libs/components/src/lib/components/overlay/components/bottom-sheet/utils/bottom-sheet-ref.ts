import { FocusOrigin } from '@angular/cdk/a11y';
import { DialogRef as CdkDialogRef } from '@angular/cdk/dialog';
import { ESCAPE, hasModifierKey } from '@angular/cdk/keycodes';
import { filter, merge, Observable, Subject, take } from 'rxjs';
import { BottomSheetContainerComponent } from '../components';
import { BottomSheetConfigType, BottomSheetState } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BottomSheetRef<T = any, R = any> {
  componentInstance: T | null = null;
  disableClose: boolean | undefined;
  id: string;

  private readonly _afterOpened = new Subject<void>();
  private readonly _beforeClosed = new Subject<R | undefined>();

  private _result: R | undefined;
  private _closeFallbackTimeout: number | null = null;
  private _state = BottomSheetState.OPEN;
  private _closeInteractionType: FocusOrigin | undefined;

  constructor(
    private _ref: CdkDialogRef<R, T>,
    config: BottomSheetConfigType,
    public _containerInstance: BottomSheetContainerComponent,
  ) {
    this.disableClose = config.disableClose;
    this.id = _ref.id;

    _containerInstance._animationStateChanged
      .pipe(
        filter((event) => event.state === 'opened'),
        take(1),
      )
      .subscribe(() => {
        this._afterOpened.next();
        this._afterOpened.complete();
      });

    _containerInstance._animationStateChanged
      .pipe(
        filter((event) => event.state === 'closed'),
        take(1),
      )
      .subscribe(() => {
        if (this._closeFallbackTimeout !== null) {
          clearTimeout(this._closeFallbackTimeout);
          this._closeFallbackTimeout = null;
        }

        this._finishBottomSheetClose();
      });

    _ref.overlayRef.detachments().subscribe(() => {
      this._beforeClosed.next(this._result);
      this._beforeClosed.complete();
      this._finishBottomSheetClose();
    });

    merge(
      this.backdropClick(),
      this.keydownEvents().pipe(
        filter((event) => event.keyCode === ESCAPE && !this.disableClose && !hasModifierKey(event)),
      ),
    ).subscribe((event) => {
      if (!this.disableClose) {
        event.preventDefault();
        this._closeBottomSheetVia(this, event.type === 'keydown' ? 'keyboard' : 'mouse');
      }
    });
  }

  close(bottomSheetResult?: R): void {
    this._result = bottomSheetResult;

    this._containerInstance._animationStateChanged
      .pipe(
        filter((event) => event.state === 'closing'),
        take(1),
      )
      .subscribe((event) => {
        this._beforeClosed.next(bottomSheetResult);
        this._beforeClosed.complete();
        this._ref.overlayRef.detachBackdrop();
        this._closeFallbackTimeout = window.setTimeout(() => this._finishBottomSheetClose(), event.totalTime + 100);
      });

    this._state = BottomSheetState.CLOSING;
    this._containerInstance._startExitAnimation();
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

  addPanelClass(classes: string | string[]): this {
    this._ref.addPanelClass(classes);
    return this;
  }

  removePanelClass(classes: string | string[]): this {
    this._ref.removePanelClass(classes);
    return this;
  }

  getState(): BottomSheetState {
    return this._state;
  }

  private _finishBottomSheetClose() {
    this._state = BottomSheetState.CLOSED;
    this._ref.close(this._result, { focusOrigin: this._closeInteractionType });
    this.componentInstance = null;
  }

  _closeBottomSheetVia<R>(ref: BottomSheetRef<R>, interactionType: FocusOrigin, result?: R) {
    (ref as unknown as { _closeInteractionType: FocusOrigin })._closeInteractionType = interactionType;
    return ref.close(result);
  }
}
