import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig } from '@angular/cdk/dialog';
import { ComponentType, NoopScrollStrategy, ViewportRuler } from '@angular/cdk/overlay';
import {
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  TemplateRef,
  computed,
  createEnvironmentInjector,
  effect,
  inject,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  ROOT_BOUNDARY_TOKEN,
  RootBoundaryDirective,
  elementCanScroll,
  equal,
  injectBreakpointObserver,
  injectRoute,
} from '@ethlete/core';
import { fromEvent, map, of, startWith, switchMap, tap } from 'rxjs';
import { ProvideThemeDirective, THEME_PROVIDER } from '../../../../../theming';
import { OverlayContainerComponent } from '../components/overlay-container';
import { OVERLAY_CONFIG, OVERLAY_DATA, OVERLAY_DEFAULT_OPTIONS } from '../constants';
import { OverlayBreakpointConfig, OverlayConfig } from '../types';
import {
  ET_OVERLAY_BOTTOM_SHEET_CLASS,
  ET_OVERLAY_LEFT_SHEET_CLASS,
  ET_OVERLAY_RIGHT_SHEET_CLASS,
  ET_OVERLAY_TOP_SHEET_CLASS,
  OverlayPositionBuilder,
  OverlayRef,
  createOverlayConfig,
} from '../utils';

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

const isHtmlElement = (element: HTMLElement | unknown): element is HTMLElement => {
  return element instanceof HTMLElement;
};

const isTouchEvent = (event: Event): event is TouchEvent => {
  return event.type[0] === 't';
};

const isPointerEvent = (event: Event): event is PointerEvent => {
  return event.type[0] === 'c';
};

const BLOCK_CLASS = 'cdk-global-scrollblock';
const OVERSCROLL_CLASS = 'et-global-no-overscroll';

@Injectable({ providedIn: 'root' })
export class OverlayService {
  private defaultOptions = inject(OVERLAY_DEFAULT_OPTIONS, { optional: true });
  private dialog = inject(CdkDialog);
  private breakpointObserver = injectBreakpointObserver();
  private viewportRuler = inject(ViewportRuler);
  private injector = inject(EnvironmentInjector);

  openOverlays = signal<OverlayRef[]>([]);
  hasOpenOverlays = computed(() => this.openOverlays().length > 0);
  positions = new OverlayPositionBuilder();
  route = injectRoute();

  constructor() {
    this.setupScrollBlocking();
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

    const composedConfig = createOverlayConfig<D>(this.defaultOptions as OverlayConfig<D>, config);
    composedConfig.id = composedConfig.id || `${ID_PREFIX}${uniqueId++}`;

    const cdkRef = this.dialog.open<R, D, T>(componentOrTemplateRef, {
      ...composedConfig,
      scrollStrategy: new NoopScrollStrategy(),
      disableClose: true,
      closeOnDestroy: false,
      panelClass: 'et-overlay-pane',
      container: {
        type: OverlayContainerComponent,
        providers: () => [
          { provide: OVERLAY_CONFIG, useValue: composedConfig },
          { provide: CdkDialogConfig, useValue: composedConfig },
        ],
      },
      templateContext: () => ({ dialogRef: overlayRef }),
      providers: (ref, cdkConfig, overlayContainer) => {
        const container = overlayContainer as OverlayContainerComponent;
        overlayRef = new OverlayRef(ref, composedConfig, container);

        return [
          { provide: OverlayContainerComponent, useValue: overlayContainer },
          { provide: THEME_PROVIDER, useValue: container._themeProvider },
          { provide: ProvideThemeDirective, useValue: container._themeProvider },
          { provide: ROOT_BOUNDARY_TOKEN, useValue: container._rootBoundary },
          { provide: RootBoundaryDirective, useValue: container._rootBoundary },
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

    const containerEl = overlayRef!._containerInstance.elementRef.nativeElement as HTMLElement;
    const overlayPaneEl = cdkRef.overlayRef.overlayElement;
    const backdropEl = cdkRef.overlayRef.backdropElement;
    const overlayWrapper = cdkRef.overlayRef.hostElement;
    const useDefaultAnimation = composedConfig.customAnimated !== true;
    const origin = composedConfig.origin;
    const injector = createEnvironmentInjector([], this.injector);

    const breakpointMatchResults = runInInjectionContext(injector, () =>
      composedConfig.positions.map((breakpoint) =>
        breakpoint.breakpoint
          ? {
              isActive: this.breakpointObserver.observeBreakpoint({ min: breakpoint.breakpoint }),
              config: breakpoint.config,
              size:
                typeof breakpoint.breakpoint === 'number'
                  ? breakpoint.breakpoint
                  : breakpoint.breakpoint === undefined
                    ? 0
                    : this.breakpointObserver.getBreakpointSize(breakpoint.breakpoint, 'min'),
            }
          : {
              isActive: signal(true),
              config: breakpoint.config,
              size: 0,
            },
      ),
    );

    const highestMatchedBreakpointConfig = linkedSignal<
      OverlayBreakpointConfig,
      { currentConfig: OverlayBreakpointConfig; previousConfig: OverlayBreakpointConfig | undefined }
    >({
      source: () => {
        const activeBreakpoints = breakpointMatchResults.filter((entry) => entry.isActive());
        const highestBreakpoint = activeBreakpoints.reduce((prev, curr) => (prev.size > curr.size ? prev : curr));

        return highestBreakpoint.config;
      },
      computation: (source, prev) => ({
        currentConfig: source,
        previousConfig: prev?.source,
      }),
    });

    effect(
      () => {
        const { currentConfig: currConfig, previousConfig: prevConfig } = highestMatchedBreakpointConfig();

        untracked(() => {
          const containerClass = currConfig.containerClass;

          const applyDefaultMaxWidths = () => {
            setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
            setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);
          };

          if (origin) {
            if (!currConfig.applyTransformOrigin) {
              setStyle(containerEl, 'transform-origin', null);
            } else {
              // TODO: If getBoundingClientRect is used it should use the center of the element.
              const originX = isHtmlElement(origin)
                ? origin.getBoundingClientRect().left
                : isTouchEvent(origin)
                  ? origin.targetTouches[0]!.clientX
                  : isPointerEvent(origin)
                    ? origin.clientX !== 0
                      ? origin.clientX
                      : (origin.target as HTMLElement).getBoundingClientRect().left
                    : -1;
              const originY = isHtmlElement(origin)
                ? origin.getBoundingClientRect().top
                : isTouchEvent(origin)
                  ? origin.targetTouches[0]!.clientY
                  : isPointerEvent(origin)
                    ? origin.clientY !== 0
                      ? origin.clientY
                      : (origin.target as HTMLElement).getBoundingClientRect().top
                    : -1;

              if (originX !== -1 && originY !== -1) {
                setStyle(containerEl, 'transform-origin', `${originX}px ${originY}px`);
              }
            }
          }

          if (useDefaultAnimation && containerClass?.length) {
            if (
              containerClass?.includes(ET_OVERLAY_LEFT_SHEET_CLASS) ||
              containerClass?.includes(ET_OVERLAY_RIGHT_SHEET_CLASS)
            ) {
              setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
              setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);
            } else if (
              containerClass?.includes(ET_OVERLAY_TOP_SHEET_CLASS) ||
              containerClass?.includes(ET_OVERLAY_BOTTOM_SHEET_CLASS)
            ) {
              setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);

              setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
            } else {
              applyDefaultMaxWidths();
            }
          } else {
            applyDefaultMaxWidths();
          }

          setStyle(overlayPaneEl, 'min-width', currConfig.minWidth);
          setStyle(overlayPaneEl, 'min-height', currConfig.minHeight);

          setStyle(overlayPaneEl, 'width', currConfig.width);
          setStyle(overlayPaneEl, 'height', currConfig.height);

          setClass(containerEl, prevConfig?.containerClass, currConfig?.containerClass);
          setClass(overlayPaneEl, prevConfig?.paneClass, currConfig?.paneClass);
          setClass(overlayWrapper, prevConfig?.overlayClass, currConfig?.overlayClass);

          // FIXME: These classes should only be removed if no open overlays require them inside their config.
          setClass(document.documentElement, prevConfig?.documentClass, currConfig?.documentClass);
          setClass(document.body, prevConfig?.bodyClass, currConfig?.bodyClass);

          if (backdropEl) {
            setClass(backdropEl, prevConfig?.backdropClass, currConfig?.backdropClass);
          }

          if (!equal(prevConfig?.position, currConfig?.position)) {
            overlayRef.updatePosition(currConfig.position);
          }

          if (currConfig.positionStrategy) {
            cdkRef.overlayRef.updatePositionStrategy(
              currConfig.positionStrategy(isHtmlElement(origin) ? origin : (origin?.target as HTMLElement | undefined)),
            );
          } else {
            cdkRef.overlayRef.updatePosition();
          }

          if (currConfig.dragToDismiss) {
            overlayRef._containerInstance._enableDragToDismiss(currConfig.dragToDismiss);
          } else {
            overlayRef._containerInstance._disableDragToDismiss();
          }
        });
      },
      { injector },
    );

    this.openOverlays.update((overlays) => [...overlays, overlayRef!]);

    overlayRef!.beforeClosed().subscribe(() => {
      // FIXME: These classes should only be removed if no open overlays require them inside their config.
      const documentClasses = composedConfig.positions.map((position) => position.config.documentClass);

      for (const klass of documentClasses) {
        if (!klass) continue;

        if (Array.isArray(klass)) {
          document.documentElement.classList.remove(...klass);
        } else {
          document.documentElement.classList.remove(klass);
        }
      }

      const bodyClasses = composedConfig.positions.map((position) => position.config.bodyClass);

      for (const klass of bodyClasses) {
        if (!klass) continue;

        if (Array.isArray(klass)) {
          document.body.classList.remove(...klass);
        } else {
          document.body.classList.remove(klass);
        }
      }
    });

    overlayRef!.afterClosed().subscribe(() => {
      const index = this.openOverlays().indexOf(overlayRef);

      if (index === -1) return;

      this.openOverlays.update((overlays) => overlays.filter((_, i) => i !== index));
      injector.destroy();
    });

    return overlayRef!;

    /* eslint-enable @typescript-eslint/no-non-null-assertion*/
  }

  closeAll(): void {
    this.closeOverlays(this.openOverlays());
  }

  getOverlayById(id: string) {
    return this.openOverlays().find((overlay) => overlay.id === id) ?? null;
  }

  private closeOverlays(overlays: OverlayRef[]) {
    let i = overlays.length;

    while (i--) {
      overlays[i]?.close();
    }
  }

  private setupScrollBlocking() {
    const previousHTMLStyles = { top: '', left: '' };
    let previousScrollPosition: { top: number; left: number } = { top: 0, left: 0 };
    let isEnabled = false;
    let lastRoute: string | null = null;

    const root = document.documentElement;

    toObservable(this.hasOpenOverlays)
      .pipe(
        switchMap((hasOpenOverlays) => {
          if (!hasOpenOverlays) return of({ hasOpenOverlays, scrolled: false });

          return fromEvent(window, 'resize').pipe(
            startWith({ hasOpenOverlays, scrolled: true }),
            map(() => ({ hasOpenOverlays, scrolled: true })),
          );
        }),
        tap(({ hasOpenOverlays }) => {
          const hasBlockClass = root.classList.contains(BLOCK_CLASS);

          if (hasOpenOverlays && (hasBlockClass || elementCanScroll(root))) {
            if (isEnabled) return;

            previousScrollPosition = this.viewportRuler.getViewportScrollPosition();
            previousHTMLStyles.left = root.style.left || '';
            previousHTMLStyles.top = root.style.top || '';

            root.style.left = coerceCssPixelValue(-previousScrollPosition.left);
            root.style.top = coerceCssPixelValue(-previousScrollPosition.top);
            root.classList.add(BLOCK_CLASS, OVERSCROLL_CLASS);

            isEnabled = true;
            lastRoute = this.route();
          } else if (!hasOpenOverlays) {
            if (!isEnabled) return;

            const htmlStyle = root.style;
            const bodyStyle = document.body.style;
            const previousHtmlScrollBehavior = htmlStyle.scrollBehavior || '';
            const previousBodyScrollBehavior = bodyStyle.scrollBehavior || '';

            const didNavigate = lastRoute !== this.route();

            root.classList.remove(BLOCK_CLASS, OVERSCROLL_CLASS);

            root.style.left = previousHTMLStyles.left;
            root.style.top = previousHTMLStyles.top;

            if (!didNavigate) {
              htmlStyle.scrollBehavior = bodyStyle.scrollBehavior = 'auto';
              window.scroll(previousScrollPosition.left, previousScrollPosition.top);
              htmlStyle.scrollBehavior = previousHtmlScrollBehavior;
              bodyStyle.scrollBehavior = previousBodyScrollBehavior;
            }

            isEnabled = false;
            lastRoute = null;
          }
        }),
      )
      .subscribe();
  }
}
