import { Directive, InjectionToken, TemplateRef, ViewContainerRef, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, of, switchMap, take, tap } from 'rxjs';
import { RuntimeError } from '../utils/runtime-error';
import { ANIMATED_LIFECYCLE_TOKEN } from './animated-lifecycle.directive';
import { ANIMATION_ERROR_CODES } from './animation-errors';

export const ANIMATED_IF_TOKEN = new InjectionToken<AnimatedIfDirective>('ANIMATED_IF_TOKEN');

export type AnimatedIfContext<T> = {
  $implicit: T;
  etAnimatedIf: T;
};

@Directive({
  selector: '[etAnimatedIf]',
  providers: [
    {
      provide: ANIMATED_IF_TOKEN,
      useExisting: AnimatedIfDirective,
    },
  ],
})
export class AnimatedIfDirective<T = unknown> {
  static ngTemplateGuard_etAnimatedIf: 'binding';

  private templateRef = inject<TemplateRef<AnimatedIfContext<T>>>(TemplateRef);
  private viewContainerRef = inject(ViewContainerRef);
  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN, { optional: true });

  private hasView = false;
  private context = { $implicit: null, etAnimatedIf: null } as AnimatedIfContext<T>;

  ifValue = input<T | null>(null, { alias: 'etAnimatedIf' });

  static ngTemplateContextGuard<T>(
    _dir: AnimatedIfDirective<T>,
    _ctx: unknown,
  ): _ctx is AnimatedIfContext<Exclude<T, false | 0 | '' | null | undefined>> {
    return true;
  }

  constructor() {
    const animatedLifecycle = this.animatedLifecycle;

    if (!animatedLifecycle) {
      throw new RuntimeError(
        ANIMATION_ERROR_CODES.MISSING_ANIMATED_LIFECYCLE,
        '*etAnimatedIf needs an element with [etAnimatedLifecycle] around it to animate against.',
      );
    }

    toObservable(this.ifValue)
      .pipe(
        switchMap((value) => {
          if (value) {
            this.context.$implicit = value;
            this.context.etAnimatedIf = value;

            if (!this.hasView) {
              this.viewContainerRef.createEmbeddedView(this.templateRef, this.context);
              this.hasView = true;
            }

            if (animatedLifecycle.state() !== 'entered') animatedLifecycle.enter();

            return of(null);
          }

          if (!this.hasView) {
            return of(null);
          }

          animatedLifecycle.leave();

          return animatedLifecycle.state$.pipe(
            filter((state) => state === 'left'),
            take(1),
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
