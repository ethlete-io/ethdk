import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  TemplateRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
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
import { ToggletipContent } from './headless/toggletip.directive';

@Component({
  selector: 'et-toggletip',
  templateUrl: './toggletip.component.html',
  styleUrl: './toggletip.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, AnimatedLifecycleDirective],
  hostDirectives: [ProvideColorDirective, ProvideSurfaceDirective],
  host: {
    class: 'et-toggletip',
    '[attr.id]': 'toggletipId()',
    '[attr.data-has-template]': 'hasTemplate() || null',
  },
})
export class ToggletipComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private triggerColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private triggerSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  protected injector = inject(Injector);

  public toggletipId = input.required<string>();
  protected contentId = input.required<string>();
  public content = input.required<ToggletipContent>();
  public colorProvider = input.required<ProvideColorDirective | null>();
  public surfaceProvider = input.required<ProvideSurfaceDirective | null>();

  public animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);
  private surfaceThemes = injectSurfaceThemes({ optional: true });

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
    const parentSurfaceProvider = this.surfaceProvider() ?? this.triggerSurfaceProvider ?? null;

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
    effect(() => {
      const providedColor = this.colorProvider() ?? this.triggerColorProvider ?? null;

      untracked(() => {
        if (providedColor) {
          this.ownColorProvider.syncWithProvider(providedColor);
        }
      });
    });

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        setInputSignal(this.ownSurfaceProvider.surface, surface);
      });
    });
  }
}
