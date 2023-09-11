import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import { ComponentRef, Injectable, OnDestroy, TemplateRef, inject } from '@angular/core';
import { ViewportService, createDestroy, equal } from '@ethlete/core';
import { Observable, Subject, combineLatest, defer, map, of, pairwise, startWith, takeUntil, tap } from 'rxjs';
import { OverlayContainerComponent } from '../components';
import { OVERLAY_CONFIG, OVERLAY_DATA, OVERLAY_DEFAULT_OPTIONS, OVERLAY_SCROLL_STRATEGY } from '../constants';
import { OverlayConfig } from '../types';
import { OverlayPositionBuilder, OverlayRef, createOverlayConfig } from '../utils';

let uniqueId = 0;
const ID_PREFIX = 'et-overlay-';

const setStyle = (el: HTMLElement, style: string, value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    el.style.removeProperty(style);
  } else {
    el.style.setProperty(style, coerceCssPixelValue(value));
  }
};

const setClass = (el: HTMLElement, prevClass?: string | string[], currClass?: string | string[]) => {
  if (!equal(prevClass, currClass)) {
    if (prevClass) {
      if (Array.isArray(prevClass)) {
        el.classList.remove(...prevClass);
      } else {
        el.classList.remove(prevClass);
      }
    }

    if (currClass) {
      if (Array.isArray(currClass)) {
        el.classList.add(...currClass);
      } else {
        el.classList.add(currClass);
      }
    }
  }
};

@Injectable()
export class OverlayService implements OnDestroy {
  private readonly _destroy$ = createDestroy();
  private readonly _defaultOptions = inject(OVERLAY_DEFAULT_OPTIONS, { optional: true });
  private readonly _scrollStrategy = inject(OVERLAY_SCROLL_STRATEGY);
  private readonly _parentOverlayService = inject(OverlayService, { optional: true, skipSelf: true });
  private readonly _dialog = inject(CdkDialog);
  private readonly _viewportService = inject(ViewportService);

  private readonly _openOverlaysAtThisLevel: OverlayRef[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<OverlayRef>();

  readonly positions = new OverlayPositionBuilder();

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

  open<T, D = unknown, R = unknown>(component: ComponentType<T>, config: OverlayConfig<D>): OverlayRef<T, R>;
  open<T, D = unknown, R = unknown>(template: TemplateRef<T>, config: OverlayConfig<D>): OverlayRef<T, R>;
  open<T, D = unknown, R = unknown>(
    template: ComponentType<T> | TemplateRef<T>,
    config: OverlayConfig<D>,
  ): OverlayRef<T, R>;
  open<T, D = unknown, R = unknown>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config: OverlayConfig<D>,
  ): OverlayRef<T, R> {
    let overlayRef: OverlayRef<T, R>;

    const composedConfig = createOverlayConfig<D>(this._defaultOptions as OverlayConfig<D>, config);
    composedConfig.id = composedConfig.id || `${ID_PREFIX}${uniqueId++}`;
    composedConfig.scrollStrategy = composedConfig.scrollStrategy || this._scrollStrategy();

    const cdkRef = this._dialog.open<R, D, T>(componentOrTemplateRef, {
      ...composedConfig,
      disableClose: true,
      closeOnDestroy: false,
      container: {
        type: OverlayContainerComponent,
        providers: () => [
          { provide: OVERLAY_CONFIG, useValue: composedConfig },
          { provide: CdkDialogConfig, useValue: composedConfig },
        ],
      },
      templateContext: () => ({ dialogRef: overlayRef }),
      providers: (ref, cdkConfig, overlayContainer) => {
        overlayRef = new OverlayRef(ref, composedConfig, overlayContainer as OverlayContainerComponent);

        return [
          { provide: OverlayContainerComponent, useValue: overlayContainer },
          { provide: OVERLAY_DATA, useValue: cdkConfig.data },
          { provide: OverlayRef, useValue: overlayRef },
          ...(composedConfig.providers ?? []),
        ];
      },
    });

    /* eslint-disable @typescript-eslint/no-non-null-assertion*/
    (overlayRef! as { componentRef: ComponentRef<T> }).componentRef = cdkRef.componentRef!;
    overlayRef!.componentInstance = cdkRef.componentInstance!;

    (cdkRef.containerInstance as OverlayContainerComponent).overlayRef = overlayRef!;

    if (composedConfig.positions?.length) {
      combineLatest(
        composedConfig.positions.map((breakpoint) =>
          (breakpoint.breakpoint ? this._viewportService.observe({ min: breakpoint.breakpoint }) : of(true)).pipe(
            map((isActive) => ({
              isActive,
              config: breakpoint.config,
              size:
                typeof breakpoint.breakpoint === 'number'
                  ? breakpoint.breakpoint
                  : breakpoint.breakpoint === undefined
                  ? 0
                  : this._viewportService.getBreakpointSize(breakpoint.breakpoint, 'min'),
            })),
          ),
        ),
      )
        .pipe(
          takeUntil(overlayRef!.afterClosed()),
          takeUntil(this._destroy$),
          map((entries) => {
            const activeBreakpoints = entries.filter((entry) => entry.isActive);
            const highestBreakpoint = activeBreakpoints.reduce((prev, curr) => (prev.size > curr.size ? prev : curr));

            return highestBreakpoint.config;
          }),
          startWith(null),
          pairwise(),
          tap(([prevConfig, currConfig]) => {
            if (!currConfig) return;

            const overlayPaneEl = cdkRef.overlayRef.overlayElement;
            const containerEl = overlayRef._containerInstance.elementRef.nativeElement;
            const backdropEl = cdkRef.overlayRef.backdropElement;
            const overlayWrapper = cdkRef.overlayRef.hostElement;

            setStyle(overlayPaneEl, 'min-width', currConfig.minWidth);
            setStyle(overlayPaneEl, 'min-height', currConfig.minHeight);
            setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
            setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);
            setStyle(overlayPaneEl, 'width', currConfig.width);
            setStyle(overlayPaneEl, 'height', currConfig.height);

            setClass(containerEl, prevConfig?.containerClass, currConfig?.containerClass);
            setClass(overlayPaneEl, prevConfig?.paneClass, currConfig?.paneClass);
            setClass(overlayWrapper, prevConfig?.overlayClass, currConfig?.overlayClass);

            if (backdropEl) {
              setClass(backdropEl, prevConfig?.backdropClass, currConfig?.backdropClass);
            }

            if (!equal(prevConfig?.position, currConfig?.position)) {
              overlayRef.updatePosition(currConfig.position);
            }

            if (currConfig.positionStrategy) {
              cdkRef.overlayRef.updatePositionStrategy(currConfig.positionStrategy);
            } else {
              cdkRef.overlayRef.updatePosition();
            }

            if (currConfig.dragToDismiss) {
              overlayRef._containerInstance._enableDragToDismiss(currConfig.dragToDismiss);
            } else {
              overlayRef._containerInstance._disableDragToDismiss();
            }
          }),
        )
        .subscribe();
    }

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
