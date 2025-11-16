import { NgIf } from '@angular/common';
import { Directive, InjectionToken, inject, input } from '@angular/core';
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
  hostDirectives: [NgIf],
})
export class AnimatedIfDirective {
  private ngIf = inject(NgIf);
  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  ifValue = input<unknown>(null, { alias: 'etAnimatedIf' });

  constructor() {
    toObservable(this.ifValue)
      .pipe(
        switchMap((value) => {
          if (value) {
            this.ngIf.ngIf = value;

            this.animatedLifecycle.enter();

            return of(null);
          }

          this.animatedLifecycle.leave();

          return this.animatedLifecycle.state$.pipe(
            filter((state) => state === 'left'),
            tap(() => {
              this.ngIf.ngIf = value;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
