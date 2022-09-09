import { ComponentType, Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import {
  Directive,
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  OnDestroy,
  Optional,
  SkipSelf,
  TemplateRef,
  Type,
} from '@angular/core';
import { DialogConfig } from './dialog-config';
import { DialogContainerComponent } from './dialog-container';
import { DialogRef } from './dialog-ref';
import { defer, Observable, Subject } from 'rxjs';
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig } from '@angular/cdk/dialog';
import { startWith } from 'rxjs/operators';
import { DialogContainerBaseComponent } from './dialog-container-base';

export const DIALOG_DATA = new InjectionToken('DialogData');
export const DIALOG_DEFAULT_OPTIONS = new InjectionToken<DialogConfig>('DialogDefaultOptions');
export const DIALOG_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('DialogScrollStrategy');

export function DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

export const DIALOG_SCROLL_STRATEGY_PROVIDER = {
  provide: DIALOG_SCROLL_STRATEGY,
  deps: [Overlay],
  useFactory: DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

export function DIALOG_SCROLL_STRATEGY_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

let uniqueId = 0;

@Directive()
export abstract class DialogServiceBase<C extends DialogContainerBaseComponent> implements OnDestroy {
  private readonly _openDialogsAtThisLevel: DialogRef[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<DialogRef>();
  private _scrollStrategy: () => ScrollStrategy;
  protected _idPrefix = 'et-dialog-';
  private _dialog: CdkDialog;
  protected dialogConfigClass = DialogConfig;

  readonly afterAllClosed: Observable<void> = defer(() =>
    this.openDialogs.length ? this._getAfterAllClosed() : this._getAfterAllClosed().pipe(startWith(undefined)),
  ) as Observable<void>;

  get openDialogs(): DialogRef[] {
    return this._parentDialog ? this._parentDialog.openDialogs : this._openDialogsAtThisLevel;
  }

  get afterOpened(): Subject<DialogRef> {
    return this._parentDialog ? this._parentDialog.afterOpened : this._afterOpenedAtThisLevel;
  }

  private _getAfterAllClosed(): Subject<void> {
    const parent = this._parentDialog;
    return parent ? parent._getAfterAllClosed() : this._afterAllClosedAtThisLevel;
  }

  constructor(
    private _overlay: Overlay,
    injector: Injector,
    private _defaultOptions: DialogConfig | undefined,
    private _parentDialog: DialogServiceBase<C> | undefined,
    scrollStrategy: () => ScrollStrategy,
    private _dialogRefConstructor: Type<DialogRef>,
    private _dialogContainerType: Type<C>,
    private _dialogDataToken: InjectionToken<unknown>,
  ) {
    this._scrollStrategy = scrollStrategy;
    this._dialog = injector.get(CdkDialog);
  }

  /**
   * Opens a modal dialog containing the given component.
   */
  open<T, D = unknown, R = unknown>(component: ComponentType<T>, config?: DialogConfig<D>): DialogRef<T, R>;

  /**
   * Opens a modal dialog containing the given template.
   */
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
    config = { ...(this._defaultOptions || new DialogConfig()), ...config };
    config.id = config.id || `${this._idPrefix}${uniqueId++}`;
    config.scrollStrategy = config.scrollStrategy || this._scrollStrategy();

    const cdkRef = this._dialog.open<R, D, T>(componentOrTemplateRef, {
      ...config,
      positionStrategy: this._overlay.position().global().centerHorizontally().centerVertically(),
      disableClose: true,
      closeOnDestroy: false,
      container: {
        type: this._dialogContainerType,
        providers: () => [
          { provide: this.dialogConfigClass, useValue: config },
          { provide: CdkDialogConfig, useValue: config },
        ],
      },
      templateContext: () => ({ dialogRef }),
      providers: (ref, cdkConfig, dialogContainer) => {
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

  /**
   * Closes all of the currently-open dialogs.
   */
  closeAll(): void {
    this._closeDialogs(this.openDialogs);
  }

  /**
   * Finds an open dialog by its id.
   */
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
      dialogs[i].close();
    }
  }
}

@Injectable()
export class DialogService extends DialogServiceBase<DialogContainerComponent> {
  constructor(
    overlay: Overlay,
    injector: Injector,
    @Optional() @Inject(DIALOG_DEFAULT_OPTIONS) defaultOptions: DialogConfig,
    @Inject(DIALOG_SCROLL_STRATEGY) scrollStrategy: () => ScrollStrategy,
    @Optional() @SkipSelf() parentDialog: DialogService,
  ) {
    super(
      overlay,
      injector,
      defaultOptions,
      parentDialog,
      scrollStrategy,
      DialogRef,
      DialogContainerComponent,
      DIALOG_DATA,
    );
  }
}
