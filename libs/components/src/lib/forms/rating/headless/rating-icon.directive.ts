import { DestroyRef, Directive, TemplateRef, inject } from '@angular/core';
import { RatingDirective, RatingIconState } from './rating.directive';

export type RatingIconContext = {
  $implicit: RatingIconState;
  index: number;
};

/** Replaces the default star with a custom icon template — rendered once per rating step. */
@Directive({
  selector: 'ng-template[etRatingIcon]',
  exportAs: 'etRatingIcon',
})
export class RatingIconDirective {
  private rating = inject(RatingDirective, { optional: true });
  public templateRef = inject<TemplateRef<RatingIconContext>>(TemplateRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.rating?.registeredIconTemplate.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.rating?.registeredIconTemplate() === this) {
        this.rating.registeredIconTemplate.set(null);
      }
    });
  }
}
