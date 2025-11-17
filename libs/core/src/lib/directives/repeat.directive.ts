import {
  Directive,
  effect,
  EmbeddedViewRef,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

@Directive({
  selector: '[etRepeat]',
})
export class RepeatDirective {
  private mainTemplateRef = inject<TemplateRef<unknown>>(TemplateRef);
  private viewContainerRef = inject(ViewContainerRef);

  repeatCount = input(2, { alias: 'etRepeat', transform: numberAttribute });

  views = linkedSignal<number, EmbeddedViewRef<unknown>[]>({
    source: this.repeatCount,
    computation: (count, previous) => {
      const prevCount = previous?.source ?? 0;
      const views: EmbeddedViewRef<unknown>[] = previous?.value ?? [];

      if (count === prevCount && previous?.value) {
        return previous.value;
      }

      const viewsToCreate = count - prevCount;

      if (viewsToCreate > 0) {
        for (let i = 0; i < viewsToCreate; i++) {
          views.push(this.viewContainerRef.createEmbeddedView(this.mainTemplateRef));
        }
      } else if (viewsToCreate < 0) {
        for (let i = 0; i < -viewsToCreate; i++) {
          this.viewContainerRef.remove(this.viewContainerRef.length - 1);
        }

        views.splice(viewsToCreate);
      }

      return views;
    },
  });

  constructor() {
    // Ugly but needed to trigger the linked signal.
    // Otherwise it has no consumers and won't run.
    effect(() => this.views());
  }
}
