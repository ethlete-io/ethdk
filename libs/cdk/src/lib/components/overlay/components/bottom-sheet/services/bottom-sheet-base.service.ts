/* eslint-disable @angular-eslint/prefer-inject */
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig } from '@angular/cdk/dialog';
import { ComponentType, Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Directive, InjectionToken, Injector, OnDestroy, TemplateRef, Type } from '@angular/core';
import { Observable, Subject, defer, startWith } from 'rxjs';
import { BOTTOM_SHEET_CONFIG } from '../constants';
import { BottomSheetContainerBaseComponent } from '../partials/bottom-sheet-container-base';
import { BottomSheetConfig } from '../types';
import { BottomSheetRef, createBottomSheetConfig } from '../utils';

let uniqueId = 0;

/**
 * @deprecated Will be removed in v5.
 */
@Directive()
export abstract class BottomSheetServiceBase<C extends BottomSheetContainerBaseComponent> implements OnDestroy {
  private readonly _openBottomSheetsAtThisLevel: BottomSheetRef[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<BottomSheetRef>();
  private _scrollStrategy: () => ScrollStrategy;
  protected _idPrefix = 'et-bottom-sheet-';
  private _dialog: CdkDialog;

  readonly afterAllClosed: Observable<void> = defer(() =>
    this.openBottomSheets.length ? this._getAfterAllClosed() : this._getAfterAllClosed().pipe(startWith(undefined)),
  ) as Observable<void>;

  get openBottomSheets(): BottomSheetRef[] {
    return this._parentBottomSheetService
      ? this._parentBottomSheetService.openBottomSheets
      : this._openBottomSheetsAtThisLevel;
  }

  get afterOpened(): Subject<BottomSheetRef> {
    return this._parentBottomSheetService ? this._parentBottomSheetService.afterOpened : this._afterOpenedAtThisLevel;
  }

  private _getAfterAllClosed(): Subject<void> {
    const parent = this._parentBottomSheetService;
    return parent ? parent._getAfterAllClosed() : this._afterAllClosedAtThisLevel;
  }

  constructor(
    private _overlay: Overlay,
    injector: Injector,
    private _defaultOptions: BottomSheetConfig | undefined,
    private _parentBottomSheetService: BottomSheetServiceBase<C> | undefined,
    scrollStrategy: () => ScrollStrategy,
    private _bottomSheetRefConstructor: Type<BottomSheetRef>,
    private _bottomSheetContainerType: Type<C>,
    private _bottomSheetDataToken: InjectionToken<unknown>,
  ) {
    this._scrollStrategy = scrollStrategy;
    this._dialog = injector.get(CdkDialog);
  }

  open<T, D = unknown, R = unknown>(component: ComponentType<T>, config?: BottomSheetConfig<D>): BottomSheetRef<T, R>;

  open<T, D = unknown, R = unknown>(template: TemplateRef<T>, config?: BottomSheetConfig<D>): BottomSheetRef<T, R>;

  open<T, D = unknown, R = unknown>(
    template: ComponentType<T> | TemplateRef<T>,
    config?: BottomSheetConfig<D>,
  ): BottomSheetRef<T, R>;

  open<T, D = unknown, R = unknown>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config?: BottomSheetConfig<D>,
  ): BottomSheetRef<T, R> {
    let bottomSheetRef: BottomSheetRef<T, R>;
    config = createBottomSheetConfig<D>(this._defaultOptions as BottomSheetConfig<D>, config);
    config.id = config.id || `${this._idPrefix}${uniqueId++}`;
    config.scrollStrategy = config.scrollStrategy || this._scrollStrategy();

    const cdkRef = this._dialog.open<R, D, T>(componentOrTemplateRef, {
      ...config,
      width: '100%',
      maxWidth: '640px',
      maxHeight: 'calc(100% - 72px)',
      height: '100%',
      positionStrategy: this._overlay.position().global().centerHorizontally().bottom('0'),
      disableClose: true,
      closeOnDestroy: false,
      container: {
        type: this._bottomSheetContainerType,
        providers: () => [
          { provide: BOTTOM_SHEET_CONFIG, useValue: config },
          { provide: CdkDialogConfig, useValue: config },
        ],
      },
      templateContext: () => ({ dialogRef: bottomSheetRef }),
      providers: (ref, cdkConfig, container) => {
        if (config?.overlayClass) {
          const overlayRefClasses = Array.isArray(config.overlayClass)
            ? config.overlayClass.join(' ')
            : config.overlayClass;

          ref.overlayRef.hostElement.classList.add(overlayRefClasses);
        }

        bottomSheetRef = new this._bottomSheetRefConstructor(ref, config, container);
        return [
          { provide: this._bottomSheetContainerType, useValue: container },
          { provide: this._bottomSheetDataToken, useValue: cdkConfig.data },
          { provide: this._bottomSheetRefConstructor, useValue: bottomSheetRef },
        ];
      },
    });

    /* eslint-disable @typescript-eslint/no-non-null-assertion*/

    bottomSheetRef!.componentInstance = cdkRef.componentInstance!;

    this.openBottomSheets.push(bottomSheetRef!);
    this.afterOpened.next(bottomSheetRef!);

    bottomSheetRef!.afterClosed().subscribe(() => {
      const index = this.openBottomSheets.indexOf(bottomSheetRef);

      if (index > -1) {
        this.openBottomSheets.splice(index, 1);

        if (!this.openBottomSheets.length) {
          this._getAfterAllClosed().next();
        }
      }
    });

    return bottomSheetRef!;

    /* eslint-enable @typescript-eslint/no-non-null-assertion*/
  }

  closeAll(): void {
    this._closeBottomSheets(this.openBottomSheets);
  }

  getBottomSheetById(id: string): BottomSheetRef | undefined {
    return this.openBottomSheets.find((bottomSheet) => bottomSheet.id === id);
  }

  ngOnDestroy() {
    this._closeBottomSheets(this._openBottomSheetsAtThisLevel);
    this._afterAllClosedAtThisLevel.complete();
    this._afterOpenedAtThisLevel.complete();
  }

  private _closeBottomSheets(bottomSheets: BottomSheetRef[]) {
    let i = bottomSheets.length;

    while (i--) {
      bottomSheets[i]?.close();
    }
  }
}
