import { FocusOrigin } from '@angular/cdk/a11y';
import { DialogRef as CdkDialogRef } from '@angular/cdk/dialog';
import { ESCAPE, hasModifierKey } from '@angular/cdk/keycodes';
import { GlobalPositionStrategy } from '@angular/cdk/overlay';
import { ComponentRef, TemplateRef, signal } from '@angular/core';
import { fromNextFrame } from '@ethlete/core';
import { Subject, filter, merge, skipUntil, switchMap, take, takeUntil } from 'rxjs';
import { OverlayContainerComponent } from './common';
import { OverlayConfig } from './overlay-config';
import { OverlayPosition } from './strategies';

export type OverlayCloseCallEvent<R = unknown> = {
  result: R | undefined;
  forced: boolean;
};

export type OverlayLayout = {
  hasHeader: boolean;
  hasBody: boolean;
  hasFooter: boolean;
};

export type OverlayHeaderTemplates = {
  current: TemplateRef<unknown> | null;
  previous: TemplateRef<unknown> | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class OverlayRef<T = any, R = any> {
  componentInstance: T | null = null;
  componentRef: ComponentRef<T> | null = null;
  disableClose: boolean | undefined;
  id: string;
  headerTemplate = signal<TemplateRef<unknown> | null>(null);

  private _afterOpened = new Subject<void>();
  private _beforeClosed = new Subject<R | undefined>();
  private _closeCalled = new Subject<OverlayCloseCallEvent<R>>();
  private _disableCloseFromInternalInitiators = new Set<string | number>();
  private _result: R | undefined;
  private _isClosing = false;

  _closeInteractionType: FocusOrigin | undefined;
  _isEscCloseControlledExternally = false;
  _isBackdropCloseControlledExternally = false;
  _isCloseFnCloseControlledExternally = false;

  get _internalDisableClose() {
    return this._disableCloseFromInternalInitiators.size > 0;
  }

  get _cdkRef() {
    return this._ref;
  }

  constructor(
    private readonly _ref: CdkDialogRef<R, T>,
    public readonly config: OverlayConfig,
    public readonly _containerInstance: OverlayContainerComponent,
  ) {
    this.disableClose = config.disableClose;
    this.id = _ref.id;

    this.setupAnimationHandlers();
    this.setupCloseHandlers();
  }

  close(result?: R, force?: boolean): void {
    if (this._isClosing) {
      return;
    }

    const currentState = this._containerInstance.animatedLifecycle.state$.value;

    if (currentState === 'leaving' || currentState === 'left') {
      return;
    }

    this._closeCalled.next({ result, forced: force ?? false });

    if (this._isCloseFnCloseControlledExternally && !force) {
      return;
    }

    this._isClosing = true;
    this._result = result;

    this._containerInstance.animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'leaving'),
        take(1),
        takeUntil(this.afterClosed()),
      )
      .subscribe(() => {
        this._ref.overlayRef.detachBackdrop();
      });

    this._containerInstance.animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'left'),
        take(1),
        takeUntil(this.afterClosed()),
      )
      .subscribe(() => {
        this.finishOverlayClose();
      });

    this._beforeClosed.next(result);
    this._beforeClosed.complete();
  }

  afterOpened() {
    return this._afterOpened.asObservable();
  }

  afterClosed() {
    return this._ref.closed;
  }

  beforeClosed() {
    return this._beforeClosed.asObservable();
  }

  backdropClick() {
    return this._ref.backdropClick;
  }

  keydownEvents() {
    return this._ref.keydownEvents;
  }

  closeCalled() {
    return this._closeCalled.asObservable();
  }

  updatePosition(position?: OverlayPosition): this {
    const strategy = this._ref.config.positionStrategy as GlobalPositionStrategy;

    if (position?.left || position?.right) {
      if (position.left) {
        strategy.left(position.left);
      } else if (position.right) {
        strategy.right(position.right);
      }
    } else {
      strategy.centerHorizontally();
    }

    if (position?.top || position?.bottom) {
      if (position.top) {
        strategy.top(position.top);
      } else if (position.bottom) {
        strategy.bottom(position.bottom);
      }
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

  _setCurrentHeaderTemplate(template: TemplateRef<unknown> | null) {
    this.headerTemplate.set(template);
  }

  private setupAnimationHandlers() {
    this._containerInstance.animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'entered'),
        take(1),
        takeUntil(this.afterClosed()),
      )
      .subscribe(() => {
        this._afterOpened.next();
        this._afterOpened.complete();
      });

    this._containerInstance.animatedLifecycle.state$
      .pipe(
        filter((event) => event === 'left'),
        take(1),
        takeUntil(this.afterClosed()),
      )
      .subscribe(() => this.finishOverlayClose());

    this._ref.overlayRef
      .detachments()
      .pipe(takeUntil(this.afterClosed()))
      .subscribe(() => {
        if (!this._isClosing) {
          this._beforeClosed.next(this._result);
          this._beforeClosed.complete();
        }
        this.finishOverlayClose();
      });
  }

  private setupCloseHandlers() {
    merge(
      this.backdropClick(),
      this.keydownEvents().pipe(
        filter((event) => event.keyCode === ESCAPE && !this.disableClose && !hasModifierKey(event)),
      ),
    )
      .pipe(
        skipUntil(
          this._containerInstance.animatedLifecycle.state$.pipe(
            filter((e) => e === 'entering'),
            switchMap(() => fromNextFrame()),
          ),
        ),
        takeUntil(this.afterClosed()),
      )
      .subscribe((event) => {
        const isEscapeKey = event.type === 'keydown';
        const isBackdropClick = !isEscapeKey;

        if (
          (this._isEscCloseControlledExternally && isEscapeKey) ||
          (this._isBackdropCloseControlledExternally && isBackdropClick)
        ) {
          return;
        }

        if (!this.disableClose && !this._internalDisableClose) {
          event.preventDefault();
          this._closeOverlayVia(isEscapeKey ? 'keyboard' : 'mouse', undefined, true);
        }
      });
  }

  private finishOverlayClose() {
    this._ref.close(this._result, { focusOrigin: this._closeInteractionType });
    this.componentInstance = null;
  }
}
