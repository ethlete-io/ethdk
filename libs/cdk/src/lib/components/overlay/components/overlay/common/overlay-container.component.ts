import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef as CdkOverlayRef } from '@angular/cdk/overlay';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  SURFACE_PROVIDER,
  SurfacedDirective,
  injectBoundaryElement,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  nextFrame,
  provideBoundaryElement,
  resolveSurfaceByElevation,
  setInputSignal,
} from '@ethlete/core';
import { BehaviorSubject, filter, take, tap } from 'rxjs';
import { OverlayConfig } from '../overlay-config';
import { OverlayRef } from '../overlay-ref';

@Component({
  selector: 'et-overlay-container',
  styleUrls: ['./overlay-container.component.scss'],
  template: `
    <div class="et-overlay-container-drag-handle"></div>
    <ng-template cdkPortalOutlet />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-overlay',
    tabindex: '-1',
    '[attr.aria-modal]': '_config.ariaModal',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledByQueue[0]',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
    '[class.et-with-default-animation]': '!_config.customAnimated',
  },
  imports: [CdkPortalOutlet],
  hostDirectives: [AnimatedLifecycleDirective, ProvideColorDirective, SurfacedDirective, ProvideSurfaceDirective],
  providers: [provideBoundaryElement()],
})
export class OverlayContainerComponent extends CdkDialogContainer<OverlayConfig> {
  private parentColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private parentSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();
  private destroyRef = inject(DestroyRef);

  colorProvider = inject(COLOR_PROVIDER);
  surfaceProvider = inject(SURFACE_PROVIDER);
  rootBoundary = injectBoundaryElement();
  animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);
  cdkOverlayRef = inject(CdkOverlayRef);
  elementRef = this._elementRef;

  private resolvedSurfaceElevation = computed(() => {
    const parent = this.parentSurfaceProvider;
    if (!parent) return 1;

    const hasBackdrop = this._config.hasBackdrop !== false;
    if (hasBackdrop) return 1;

    return parent.elevation() + 1;
  });

  overlayRef: OverlayRef | null = null;

  isContentAttached$ = new BehaviorSubject(false);

  constructor() {
    super();

    if (this.parentColorProvider) {
      this.colorProvider.syncWithProvider(this.parentColorProvider);
    }

    if (this.surfaceThemes) {
      const parentType = this.parentSurfaceProvider?.surfaceType() ?? 'dark';
      const elevation = this.resolvedSurfaceElevation();
      const resolved = resolveSurfaceByElevation(this.surfaceThemes, parentType, elevation);

      if (resolved) {
        setInputSignal(this.surfaceProvider.surface, resolved.name);
      }

      const unregister = this.surfaceContextTracker.register(parentType, elevation, resolved?.neutralColor);
      this.destroyRef.onDestroy(unregister);
    }

    this.animatedLifecycle.state$
      .pipe(
        filter((s) => s === 'entered'),
        tap(() => this._trapFocus()),
        take(1),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected override _contentAttached(): void {
    // @ts-expect-error Accessing private member
    super._initializeFocusTrap();

    this.rootBoundary.override.set(this._elementRef.nativeElement);

    nextFrame(() => {
      if (this.destroyRef.destroyed) return;

      this.isContentAttached$.next(true);
    });
  }
}
