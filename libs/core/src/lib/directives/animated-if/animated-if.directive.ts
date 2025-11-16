import { NgIf } from '@angular/common';
import { Directive, InjectionToken, Input, inject } from '@angular/core';
import { filter, takeUntil, takeWhile, tap } from 'rxjs';
import { createDestroy } from '../../utils';
import { ANIMATED_LIFECYCLE_TOKEN } from '../animated-lifecycle';

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
  private readonly _destroy$ = createDestroy();
  private readonly _ngIf = inject(NgIf);
  private readonly _animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input('etAnimatedIf')
  set shouldRender(value: unknown) {
    if (value) {
      this._ngIf.ngIf = value;

      this._animatedLifecycle.enter();
    } else {
      this._animatedLifecycle.leave();

      this._animatedLifecycle.state$
        .pipe(
          takeUntil(this._destroy$),
          takeWhile((state) => state !== 'left', true),
          filter((state) => state === 'left'),
          tap(() => {
            this._ngIf.ngIf = value;
          }),
        )
        .subscribe();
    }
  }
}
