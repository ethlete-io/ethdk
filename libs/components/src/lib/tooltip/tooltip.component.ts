import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, ViewEncapsulation, computed, effect, inject, input, untracked } from '@angular/core';
import { AutoSurfaceDirective, COLOR_PROVIDER, ProvideColorDirective } from '@ethlete/core';
import { TooltipContent } from './headless/tooltip.directive';

@Component({
  selector: 'et-tooltip',
  templateUrl: './tooltip.component.html',
  styleUrl: './tooltip.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-tooltip',
    role: 'tooltip',
    '[attr.id]': 'tooltipId()',
    '[attr.data-has-template]': 'hasTemplate() || null',
  },
})
export class TooltipComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private triggerColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  public tooltipId = input.required<string>();
  public content = input.required<TooltipContent>();
  public colorProvider = input.required<ProvideColorDirective | null>();

  public hasTemplate = computed(() => this.content() instanceof TemplateRef);
  public contentText = computed<string | null>(() => {
    const content = this.content();
    return typeof content === 'string' ? content : null;
  });
  public contentTemplate = computed<TemplateRef<unknown> | null>(() => {
    const content = this.content();
    return content instanceof TemplateRef ? content : null;
  });

  constructor() {
    // the tooltip surface IS the overlay's own surface - paint the overlay's registered elevation
    // exactly (read from the surface-context tracker), don't stack a level above it
    inject(AutoSurfaceDirective).matchOverlaySurface();

    effect(() => {
      const providedColor = this.colorProvider() ?? this.triggerColorProvider ?? null;

      untracked(() => {
        if (providedColor) {
          this.ownColorProvider.syncWithProvider(providedColor);
        }
      });
    });
  }
}
