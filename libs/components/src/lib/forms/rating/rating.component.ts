import { Component, ElementRef, ViewEncapsulation, computed, inject, viewChild, viewChildren } from '@angular/core';
import { AnimatableDirective, ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { NgTemplateOutlet } from '@angular/common';
import { STAR_ICON, IconDirective, provideIcons } from '../../icon';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';
import { RatingDirective, RatingIconContext } from './headless';

@Component({
  selector: 'et-rating',
  templateUrl: './rating.component.html',
  styleUrl: './rating.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatableDirective, FormErrorComponent, IconDirective, NgTemplateOutlet, ProvideColorDirective],
  providers: [provideFormSupport(), provideIcons(STAR_ICON)],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: RatingDirective,
      inputs: [
        'value',
        'mixed',
        'mixedLabel',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'max',
        'allowHalf',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-rating',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
  },
})
export class RatingComponent {
  public support = injectFormSupport();
  protected rating = inject(RatingDirective);

  private baseIcons = viewChildren<ElementRef<HTMLElement>>('baseIcon');

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');
  public canAnimate = createCanAnimateSignal();

  protected iconIndexes = computed(() => Array.from({ length: this.rating.effectiveMax() }, (_, index) => index + 1));

  // drive the fill overlay's continuous clip width: displayValue in icon units plus the
  // number of gaps the fill crosses (one per completed icon, none after the last)
  protected fillIcons = computed(() => this.rating.displayValue());
  protected fillGaps = computed(() => Math.max(0, Math.ceil(this.rating.displayValue()) - 1));

  private dragging = false;
  private pointerCommitted = false;

  constructor() {
    wireFormSupport(this.support, {
      errorContent: this.errorContentRef,
      hintContent: this.hintContentRef,
      errorAnimatable: this.errorAnimatableRef,
      hintAnimatable: this.hintAnimatableRef,
    });
  }

  protected iconContext(index: number): RatingIconContext {
    return { $implicit: this.rating.iconState(index), index };
  }

  protected handlePointerDown(event: PointerEvent) {
    // a fresh press must never inherit a stale commit flag from a prior sequence that ended
    // without its trailing click (drag off-target, cancelled synthetic click) — otherwise the
    // next legitimate click is swallowed once
    this.pointerCommitted = false;

    if (!this.rating.interactive()) {
      return;
    }

    this.dragging = true;

    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // pointer capture is unavailable in some test environments — dragging still works
    }

    this.rating.setHoverValue(this.valueFromPointer(event));
  }

  protected handlePointerMove(event: PointerEvent) {
    // touch previews only while swiping (a resting finger is not a hover)
    if (!this.dragging && event.pointerType === 'touch') {
      return;
    }

    this.rating.setHoverValue(this.valueFromPointer(event));
  }

  protected handlePointerUp(event: PointerEvent) {
    if (!this.dragging) {
      return;
    }

    this.dragging = false;
    this.pointerCommitted = true;
    this.rating.commitPointer(this.valueFromPointer(event));

    if (event.pointerType === 'touch') {
      this.rating.clearHover();
    }
  }

  protected handlePointerCancel(event: PointerEvent) {
    void event;
    this.dragging = false;
    this.pointerCommitted = false;
    this.rating.clearHover();
  }

  /** Fallback for synthetic clicks (tests, assistive tech) — real pointer flows commit on pointerup. */
  protected handleIconClick(index: number, event: MouseEvent) {
    if (this.pointerCommitted) {
      this.pointerCommitted = false;

      return;
    }

    if (!this.rating.allowHalf()) {
      this.rating.commitPointer(index);

      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    this.rating.commitPointer(event.clientX - rect.left < rect.width / 2 ? index - 0.5 : index);
  }

  // gap-immune: resolve the value from the actual icon rects under the pointer
  private valueFromPointer(event: PointerEvent) {
    const icons = this.baseIcons().map((ref) => ref.nativeElement);
    let value = this.rating.step();

    icons.forEach((icon, position) => {
      const rect = icon.getBoundingClientRect();
      const index = position + 1;

      if (event.clientX >= rect.right) {
        value = index;
      } else if (event.clientX >= rect.left) {
        value =
          this.rating.allowHalf() && event.clientX < rect.left + rect.width / 2 ? Math.max(0.5, index - 0.5) : index;
      }
    });

    return value;
  }
}
