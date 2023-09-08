import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig } from '@angular/cdk/dialog';
import { ComponentType, Overlay } from '@angular/cdk/overlay';
import { ComponentRef, Injectable, OnDestroy, TemplateRef, inject } from '@angular/core';
import { Observable, Subject, defer, startWith } from 'rxjs';
import { OverlayContainerComponent } from '../components';
import { OVERLAY_CONFIG, OVERLAY_DATA, OVERLAY_DEFAULT_OPTIONS, OVERLAY_SCROLL_STRATEGY } from '../constants';
import { OverlayConfig } from '../types';
import { OverlayRef, createOverlayConfig } from '../utils';

let uniqueId = 0;
const ID_PREFIX = 'et-overlay-';

@Injectable()
export class OverlayService implements OnDestroy {
  private readonly _overlay = inject(Overlay);
  private readonly _defaultOptions = inject(OVERLAY_DEFAULT_OPTIONS, { optional: true });
  private readonly _scrollStrategy = inject(OVERLAY_SCROLL_STRATEGY);
  private readonly _parentOverlayService = inject(OverlayService, { optional: true, skipSelf: true });
  private readonly _dialog = inject(CdkDialog);

  private readonly _openOverlaysAtThisLevel: OverlayRef[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<OverlayRef>();

  readonly afterAllClosed = defer(() =>
    this.openOverlays.length ? this._getAfterAllClosed() : this._getAfterAllClosed().pipe(startWith(undefined)),
  ) as Observable<void>;

  get openOverlays(): OverlayRef[] {
    return this._parentOverlayService ? this._parentOverlayService.openOverlays : this._openOverlaysAtThisLevel;
  }

  get afterOpened(): Subject<OverlayRef> {
    return this._parentOverlayService ? this._parentOverlayService.afterOpened : this._afterOpenedAtThisLevel;
  }

  ngOnDestroy() {
    this._closeOverlays(this._openOverlaysAtThisLevel);
    this._afterAllClosedAtThisLevel.complete();
    this._afterOpenedAtThisLevel.complete();
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

    const composedConfig = createOverlayConfig<D>(this._defaultOptions as OverlayConfig<D>, config);
    composedConfig.id = composedConfig.id || `${ID_PREFIX}${uniqueId++}`;
    composedConfig.scrollStrategy = composedConfig.scrollStrategy || this._scrollStrategy();

    const cdkRef = this._dialog.open<R, D, T>(componentOrTemplateRef, {
      ...config,
      positionStrategy:
        composedConfig.positionStrategy ?? this._overlay.position().global().centerHorizontally().centerVertically(),
      disableClose: true,
      closeOnDestroy: false,
      container: {
        type: OverlayContainerComponent,
        providers: () => [
          { provide: OVERLAY_CONFIG, useValue: config },
          { provide: CdkDialogConfig, useValue: config },
        ],
      },
      templateContext: () => ({ dialogRef: overlayRef }),
      providers: (ref, cdkConfig, overlayContainer) => {
        if (composedConfig.overlayClass) {
          const overlayRefClasses = Array.isArray(composedConfig.overlayClass)
            ? composedConfig.overlayClass.join(' ')
            : composedConfig.overlayClass;

          ref.overlayRef.hostElement.classList.add(overlayRefClasses);
        }

        overlayRef = new OverlayRef(ref, composedConfig, overlayContainer as OverlayContainerComponent);
        overlayRef.updatePosition(config?.position);

        return [
          { provide: OverlayContainerComponent, useValue: overlayContainer },
          { provide: OVERLAY_DATA, useValue: cdkConfig.data },
          { provide: OverlayRef, useValue: overlayRef },
        ];
      },
    });

    /* eslint-disable @typescript-eslint/no-non-null-assertion*/
    (overlayRef! as { componentRef: ComponentRef<T> }).componentRef = cdkRef.componentRef!;
    overlayRef!.componentInstance = cdkRef.componentInstance!;

    this.openOverlays.push(overlayRef!);
    this.afterOpened.next(overlayRef!);

    overlayRef!.afterClosed().subscribe(() => {
      const index = this.openOverlays.indexOf(overlayRef);

      if (index === -1) return;

      this.openOverlays.splice(index, 1);

      if (!this.openOverlays.length) {
        this._getAfterAllClosed().next();
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

  private _closeOverlays(overlays: OverlayRef[]) {
    let i = overlays.length;

    while (i--) {
      overlays[i].close();
    }
  }

  private _getAfterAllClosed(): Subject<void> {
    const parent = this._parentOverlayService;
    return parent ? parent._getAfterAllClosed() : this._afterAllClosedAtThisLevel;
  }
}
