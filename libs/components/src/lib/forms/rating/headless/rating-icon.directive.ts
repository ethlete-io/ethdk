import { DestroyRef, Directive, TemplateRef, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { RATING_ERROR_CODES } from '../rating-errors';
import { RatingDirective, RatingIconState } from './rating.directive';

export type RatingIconContext = {
  $implicit: RatingIconState;
  index: number;
};

/** Replaces the default star with a custom icon template - rendered once per rating step. */
@Directive({
  selector: 'ng-template[etRatingIcon]',
  exportAs: 'etRatingIcon',
})
export class RatingIconDirective {
  private rating = inject(RatingDirective, { optional: true });
  public templateRef = inject<TemplateRef<RatingIconContext>>(TemplateRef);
  private destroyRef = inject(DestroyRef);
  private hostElement = injectHostElement<Comment>();

  constructor() {
    if (ngDevMode && this.rating?.registeredIconTemplate()) {
      throw new RuntimeError(
        RATING_ERROR_CODES.DUPLICATE_ICON_TEMPLATE,
        '[RatingIconDirective] An et-rating accepts only one ng-template[etRatingIcon]. Remove the extra template.',
        { element: this.hostElement },
      );
    }

    this.rating?.registeredIconTemplate.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.rating?.registeredIconTemplate() === this) {
        this.rating.registeredIconTemplate.set(null);
      }
    });
  }
}
