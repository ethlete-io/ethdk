import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  SURFACE_PROVIDER,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
  setInputSignal,
} from '@ethlete/core';
import { injectOverlayData } from '../overlay';
import { TooltipContent } from './headless/tooltip.directive';

export type TooltipContentData = {
  id: string;
  content: TooltipContent;
  colorProvider: ProvideColorDirective | null;
  surfaceProvider: ProvideSurfaceDirective | null;
};

@Component({
  selector: 'et-tooltip',
  templateUrl: './tooltip.component.html',
  styleUrl: './tooltip.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, AnimatedLifecycleDirective],
  hostDirectives: [ProvideColorDirective, ProvideSurfaceDirective],
  host: {
    class: 'et-tooltip',
    role: 'tooltip',
    '[attr.id]': 'tooltipId()',
    '[attr.data-has-template]': 'hasTemplate() || null',
  },
})
export class TooltipComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private triggerColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private triggerSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });

  public animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private data = injectOverlayData<TooltipContentData>();
  public tooltipId = computed(() => this.data.id);
  public content = computed(() => this.data.content);
  public hasTemplate = computed(() => this.content() instanceof TemplateRef);
  public contentText = computed<string | null>(() => {
    const content = this.content();
    return typeof content === 'string' ? content : null;
  });
  public contentTemplate = computed<TemplateRef<unknown> | null>(() => {
    const content = this.content();
    return content instanceof TemplateRef ? content : null;
  });
  public resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const parentSurfaceProvider = this.data.surfaceProvider ?? this.triggerSurfaceProvider ?? null;

    if (!themes || !parentSurfaceProvider) {
      return null;
    }

    return (
      resolveSurfaceByElevation(
        themes,
        parentSurfaceProvider.surfaceType() ?? 'dark',
        parentSurfaceProvider.elevation() + 1,
      )?.name ?? null
    );
  });

  constructor() {
    const providedColor = this.data.colorProvider ?? this.triggerColorProvider ?? null;

    if (providedColor) {
      this.ownColorProvider.syncWithProvider(providedColor);
    }

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        setInputSignal(this.ownSurfaceProvider.surface, surface);
      });
    });
  }
}
