import { Directive, InjectionToken, TemplateRef, ViewContainerRef, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, of, switchMap, tap } from 'rxjs';
import { ANIMATED_LIFECYCLE_TOKEN } from './animated-lifecycle.directive';

export const ANIMATED_IF_TOKEN = new InjectionToken<AnimatedIfDirective>('ANIMATED_IF_TOKEN');

@Directive({
  selector: '[etAnimatedIf]',
  providers: [
    {
      provide: ANIMATED_IF_TOKEN,
      useExisting: AnimatedIfDirective,
    },
  ],
})
export class AnimatedIfDirective {
  private templateRef = inject(TemplateRef);
  private viewContainerRef = inject(ViewContainerRef);
  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  private hasView = false;

  ifValue = input<unknown>(null, { alias: 'etAnimatedIf' });

  constructor() {
    toObservable(this.ifValue)
      .pipe(
        switchMap((value) => {
          if (value) {
            if (!this.hasView) {
              this.viewContainerRef.createEmbeddedView(this.templateRef);
              this.hasView = true;
            }

            this.animatedLifecycle.enter();

            return of(null);
          }

          if (!this.hasView) {
            return of(null);
          }

          this.animatedLifecycle.leave();

          return this.animatedLifecycle.state$.pipe(
            filter((state) => state === 'left'),
            tap(() => {
              this.viewContainerRef.clear();
              this.hasView = false;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
