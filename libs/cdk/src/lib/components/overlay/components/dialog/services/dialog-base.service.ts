/* eslint-disable @angular-eslint/prefer-inject */
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig } from '@angular/cdk/dialog';
import { ComponentType, Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Directive, InjectionToken, Injector, OnDestroy, TemplateRef, Type } from '@angular/core';
import { Observable, Subject, defer, startWith } from 'rxjs';
import { DIALOG_CONFIG } from '../constants';
import { DialogContainerBaseComponent } from '../partials/dialog-container-base';
import { DialogConfig } from '../types';
import { DialogRef, createDialogConfig } from '../utils';

let uniqueId = 0;

/**
 * @deprecated Will be removed in v5.
 */
@Directive()
export abstract class DialogServiceBase<C extends DialogContainerBaseComponent> implements OnDestroy {
  private readonly _openDialogsAtThisLevel: DialogRef[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<DialogRef>();
  private _scrollStrategy: () => ScrollStrategy;
  protected _idPrefix = 'et-dialog-';
  private _dialog: CdkDialog;

  readonly afterAllClosed: Observable<void> = defer(() =>
    this.openDialogs.length ? this._getAfterAllClosed() : this._getAfterAllClosed().pipe(startWith(undefined)),
  ) as Observable<void>;

  get openDialogs(): DialogRef[] {
    return this._parentDialogService ? this._parentDialogService.openDialogs : this._openDialogsAtThisLevel;
  }

  get afterOpened(): Subject<DialogRef> {
    return this._parentDialogService ? this._parentDialogService.afterOpened : this._afterOpenedAtThisLevel;
  }

  private _getAfterAllClosed(): Subject<void> {
    const parent = this._parentDialogService;
    return parent ? parent._getAfterAllClosed() : this._afterAllClosedAtThisLevel;
  }

  constructor(
    private _overlay: Overlay,
    injector: Injector,
    private _defaultOptions: DialogConfig | undefined,
    private _parentDialogService: DialogServiceBase<C> | undefined,
    scrollStrategy: () => ScrollStrategy,
    private _dialogRefConstructor: Type<DialogRef>,
    private _dialogContainerType: Type<C>,
    private _dialogDataToken: InjectionToken<unknown>,
  ) {
    this._scrollStrategy = scrollStrategy;
    this._dialog = injector.get(CdkDialog);
  }

  open<T, D = unknown, R = unknown>(component: ComponentType<T>, config?: DialogConfig<D>): DialogRef<T, R>;

  open<T, D = unknown, R = unknown>(template: TemplateRef<T>, config?: DialogConfig<D>): DialogRef<T, R>;

  open<T, D = unknown, R = unknown>(
    template: ComponentType<T> | TemplateRef<T>,
    config?: DialogConfig<D>,
  ): DialogRef<T, R>;

  open<T, D = unknown, R = unknown>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config?: DialogConfig<D>,
  ): DialogRef<T, R> {
    let dialogRef: DialogRef<T, R>;
    config = createDialogConfig<D>(this._defaultOptions as DialogConfig<D>, config);
    config.id = config.id || `${this._idPrefix}${uniqueId++}`;
    config.scrollStrategy = config.scrollStrategy || this._scrollStrategy();

    const cdkRef = this._dialog.open<R, D, T>(componentOrTemplateRef, {
      ...config,
      positionStrategy:
        config.positionStrategy ?? this._overlay.position().global().centerHorizontally().centerVertically(),
      disableClose: true,
      closeOnDestroy: false,
      container: {
        type: this._dialogContainerType,
        providers: () => [
          { provide: DIALOG_CONFIG, useValue: config },
          { provide: CdkDialogConfig, useValue: config },
        ],
      },
      templateContext: () => ({ dialogRef }),
      providers: (ref, cdkConfig, dialogContainer) => {
        if (config?.overlayClass) {
          const overlayRefClasses = Array.isArray(config.overlayClass)
            ? config.overlayClass.join(' ')
            : config.overlayClass;

          ref.overlayRef.hostElement.classList.add(overlayRefClasses);
        }

        dialogRef = new this._dialogRefConstructor(ref, config, dialogContainer);
        dialogRef.updatePosition(config?.position);
        return [
          { provide: this._dialogContainerType, useValue: dialogContainer },
          { provide: this._dialogDataToken, useValue: cdkConfig.data },
          { provide: this._dialogRefConstructor, useValue: dialogRef },
        ];
      },
    });

    /* eslint-disable @typescript-eslint/no-non-null-assertion*/

    dialogRef!.componentInstance = cdkRef.componentInstance!;

    this.openDialogs.push(dialogRef!);
    this.afterOpened.next(dialogRef!);

    dialogRef!.afterClosed().subscribe(() => {
      const index = this.openDialogs.indexOf(dialogRef);

      if (index > -1) {
        this.openDialogs.splice(index, 1);

        if (!this.openDialogs.length) {
          this._getAfterAllClosed().next();
        }
      }
    });

    return dialogRef!;

    /* eslint-enable @typescript-eslint/no-non-null-assertion*/
  }

  closeAll(): void {
    this._closeDialogs(this.openDialogs);
  }

  getDialogById(id: string): DialogRef | undefined {
    return this.openDialogs.find((dialog) => dialog.id === id);
  }

  ngOnDestroy() {
    this._closeDialogs(this._openDialogsAtThisLevel);
    this._afterAllClosedAtThisLevel.complete();
    this._afterOpenedAtThisLevel.complete();
  }

  private _closeDialogs(dialogs: DialogRef[]) {
    let i = dialogs.length;

    while (i--) {
      dialogs[i]?.close();
    }
  }
}
