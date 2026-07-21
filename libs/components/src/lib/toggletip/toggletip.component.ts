import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  Injector,
  TemplateRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { AutoSurfaceDirective, COLOR_PROVIDER, ProvideColorDirective } from '@ethlete/core';
import { ToggletipContent } from './headless/toggletip.directive';

@Component({
  selector: 'et-toggletip',
  templateUrl: './toggletip.component.html',
  styleUrl: './toggletip.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  hostDirectives: [ProvideColorDirective, { directive: AutoSurfaceDirective, inputs: ['surfaceProvider'] }],
  host: {
    class: 'et-toggletip',
    '[attr.id]': 'toggletipId()',
    '[attr.data-has-template]': 'hasTemplate() || null',
  },
})
export class ToggletipComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private triggerColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  protected injector = inject(Injector);

  public toggletipId = input.required<string>();
  protected contentId = input.required<string>();
  public content = input.required<ToggletipContent>();
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
    // the toggletip surface IS the overlay's own surface — it adopts the trigger-context
    // elevation via its `surfaceProvider`, so it must not also stack above the overlay tracker
    inject(AutoSurfaceDirective).ignoreOverlaySurfaceContext();

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
