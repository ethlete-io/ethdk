import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig } from '@angular/cdk/dialog';
import { ComponentType, Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Directive, InjectionToken, Injector, OnDestroy, TemplateRef, Type } from '@angular/core';
import { Observable, Subject, defer, startWith } from 'rxjs';
import { OVERLAY_CONFIG } from '../constants';
import { OverlayContainerBaseComponent } from '../partials';
import { OverlayConfig } from '../types';
import { OverlayRef, createOverlayConfig } from '../utils';

let uniqueId = 0;

@Directive()
export abstract class OverlayServiceBase<C extends OverlayContainerBaseComponent> implements OnDestroy {
  private readonly _openOverlaysAtThisLevel: OverlayRef[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<OverlayRef>();
  private _scrollStrategy: () => ScrollStrategy;
  protected _idPrefix = 'et-overlay-';
  private _dialog: CdkDialog;

  readonly afterAllClosed: Observable<void> = defer(() =>
    this.openOverlays.length ? this._getAfterAllClosed() : this._getAfterAllClosed().pipe(startWith(undefined)),
  ) as Observable<void>;

  get openOverlays(): OverlayRef[] {
    return this._parentOverlayService ? this._parentOverlayService.openOverlays : this._openOverlaysAtThisLevel;
  }

  get afterOpened(): Subject<OverlayRef> {
    return this._parentOverlayService ? this._parentOverlayService.afterOpened : this._afterOpenedAtThisLevel;
  }

  private _getAfterAllClosed(): Subject<void> {
    const parent = this._parentOverlayService;
    return parent ? parent._getAfterAllClosed() : this._afterAllClosedAtThisLevel;
  }

  constructor(
    private _overlay: Overlay,
    injector: Injector,
    private _defaultOptions: OverlayConfig | undefined,
    private _parentOverlayService: OverlayServiceBase<C> | undefined,
    scrollStrategy: () => ScrollStrategy,
    private _overlayRefConstructor: Type<OverlayRef>,
    private _overlayContainerType: Type<C>,
    private _overlayDataToken: InjectionToken<unknown>,
  ) {
    this._scrollStrategy = scrollStrategy;
    this._dialog = injector.get(CdkDialog);
  }

  open<T, D = unknown, R = unknown>(component: ComponentType<T>, config?: OverlayConfig<D>): OverlayRef<T, R>;

  open<T, D = unknown, R = unknown>(template: TemplateRef<T>, config?: OverlayConfig<D>): OverlayRef<T, R>;

  open<T, D = unknown, R = unknown>(
    template: ComponentType<T> | TemplateRef<T>,
    config?: OverlayConfig<D>,
  ): OverlayRef<T, R>;

  open<T, D = unknown, R = unknown>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config?: OverlayConfig<D>,
  ): OverlayRef<T, R> {
    let overlayRef: OverlayRef<T, R>;
    config = createOverlayConfig<D>(this._defaultOptions as OverlayConfig<D>, config);
    config.id = config.id || `${this._idPrefix}${uniqueId++}`;
    config.scrollStrategy = config.scrollStrategy || this._scrollStrategy();

    const cdkRef = this._dialog.open<R, D, T>(componentOrTemplateRef, {
      ...config,
      positionStrategy:
        config.positionStrategy ?? this._overlay.position().global().centerHorizontally().centerVertically(),
      disableClose: true,
      closeOnDestroy: false,
      container: {
        type: this._overlayContainerType,
        providers: () => [
          { provide: OVERLAY_CONFIG, useValue: config },
          { provide: CdkDialogConfig, useValue: config },
        ],
      },
      templateContext: () => ({ dialogRef: overlayRef }),
      providers: (ref, cdkConfig, overlayContainer) => {
        if (config?.overlayClass) {
          const overlayRefClasses = Array.isArray(config.overlayClass)
            ? config.overlayClass.join(' ')
            : config.overlayClass;

          ref.overlayRef.hostElement.classList.add(overlayRefClasses);
        }

        overlayRef = new this._overlayRefConstructor(ref, config, overlayContainer);
        overlayRef.updatePosition(config?.position);
        return [
          { provide: this._overlayContainerType, useValue: overlayContainer },
          { provide: this._overlayDataToken, useValue: cdkConfig.data },
          { provide: this._overlayRefConstructor, useValue: overlayRef },
        ];
      },
    });

    /* eslint-disable @typescript-eslint/no-non-null-assertion*/

    overlayRef!.componentInstance = cdkRef.componentInstance!;

    this.openOverlays.push(overlayRef!);
    this.afterOpened.next(overlayRef!);

    overlayRef!.afterClosed().subscribe(() => {
      const index = this.openOverlays.indexOf(overlayRef);

      if (index > -1) {
        this.openOverlays.splice(index, 1);

        if (!this.openOverlays.length) {
          this._getAfterAllClosed().next();
        }
      }
    });

    return overlayRef!;

    /* eslint-enable @typescript-eslint/no-non-null-assertion*/
  }

  closeAll(): void {
    this._closeOverlays(this.openOverlays);
  }

  getOverlayById(id: string): OverlayRef | undefined {
    return this.openOverlays.find((overlay) => overlay.id === id);
  }

  ngOnDestroy() {
    this._closeOverlays(this._openOverlaysAtThisLevel);
    this._afterAllClosedAtThisLevel.complete();
    this._afterOpenedAtThisLevel.complete();
  }

  private _closeOverlays(overlays: OverlayRef[]) {
    let i = overlays.length;

    while (i--) {
      overlays[i].close();
    }
  }
}
