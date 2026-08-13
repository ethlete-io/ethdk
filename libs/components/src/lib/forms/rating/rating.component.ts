import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AnimatableDirective,
  DragGestureEvent,
  ProvideColorDirective,
  createCanAnimateSignal,
  dragGestureFrom,
} from '@ethlete/core';
import { NgTemplateOutlet } from '@angular/common';
import { tap } from 'rxjs';
import { STAR_ICON, IconDirective, provideIcons } from '../../icon';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormWarningComponent } from '../form-field/form-warning.component';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';
import { RatingDirective, RatingIconContext } from './headless';

@Component({
  selector: 'et-rating',
  templateUrl: './rating.component.html',
  styleUrl: './rating.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    AnimatableDirective,
    FormErrorComponent,
    FormWarningComponent,
    IconDirective,
    NgTemplateOutlet,
    ProvideColorDirective,
  ],
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
    '[attr.data-warning]': 'support.displaysWarning() || null',
  },
})
export class RatingComponent {
  public support = injectFormSupport();
  protected rating = inject(RatingDirective);
  private destroyRef = inject(DestroyRef);

  private baseIcons = viewChildren<ElementRef<HTMLElement>>('baseIcon');

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private warningContentRef = viewChild<ElementRef<HTMLElement>>('warningContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private warningAnimatableRef = viewChild<AnimatableDirective>('warningAnimatable');
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
      warningContent: this.warningContentRef,
      hintContent: this.hintContentRef,
      errorAnimatable: this.errorAnimatableRef,
      warningAnimatable: this.warningAnimatableRef,
      hintAnimatable: this.hintAnimatableRef,
    });
  }

  protected iconContext(index: number): RatingIconContext {
    return { $implicit: this.rating.iconState(index), index };
  }

  protected handlePointerDown(event: PointerEvent) {
    // a fresh press must never inherit a stale commit flag from a prior sequence that ended
    // without its trailing click (drag off-target, cancelled synthetic click) - otherwise the
    // next legitimate click is swallowed once
    this.pointerCommitted = false;

    if (!this.rating.interactive() || event.button !== 0 || this.dragging) {
      return;
    }

    const surface = event.currentTarget as HTMLElement;
    const pressX = event.clientX;
    const touch = event.pointerType === 'touch';

    this.dragging = true;
    this.rating.setHoverValue(this.valueFromPosition(pressX));

    // every pointer move counts: the preview tracks the finger from the first pixel, so there is
    // no threshold below which the press is still just a click
    dragGestureFrom(event, surface, { commitThreshold: 0 })
      .pipe(
        tap((gesture) => this.applyGesture(gesture, { pressX, touch })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Hover preview only - a press draws from its own gesture, and a resting finger is not a hover. */
  protected handlePointerMove(event: PointerEvent) {
    if (this.dragging || event.pointerType === 'touch') {
      return;
    }

    this.rating.setHoverValue(this.valueFromPosition(event.clientX));
  }

  /** Fallback for synthetic clicks (tests, assistive tech) - real pointer flows commit on pointerup. */
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

  public focus(options?: FocusOptions) {
    this.rating.focus(options);
  }

  private applyGesture(gesture: DragGestureEvent, press: { pressX: number; touch: boolean }) {
    switch (gesture.type) {
      case 'start':
        return;
      case 'move':
        this.rating.setHoverValue(this.valueFromPosition(gesture.data.clientX));

        return;
      case 'end':
      case 'tapped':
        this.dragging = false;
        this.pointerCommitted = true;
        this.rating.commitPointer(this.valueFromPosition(gesture.type === 'end' ? gesture.data.clientX : press.pressX));

        if (press.touch) {
          this.rating.clearHover();
        }

        return;
      case 'cancelled':
        // the browser took the gesture away - the user never picked a rating, so nothing commits
        this.dragging = false;
        this.pointerCommitted = false;
        this.rating.clearHover();

        return;
    }
  }

  // gap-immune: resolve the value from the actual icon rects under the pointer
  private valueFromPosition(clientX: number) {
    const icons = this.baseIcons().map((ref) => ref.nativeElement);
    let value = this.rating.step();

    icons.forEach((icon, position) => {
      const rect = icon.getBoundingClientRect();
      const index = position + 1;

      if (clientX >= rect.right) {
        value = index;
      } else if (clientX >= rect.left) {
        value = this.rating.allowHalf() && clientX < rect.left + rect.width / 2 ? Math.max(0.5, index - 0.5) : index;
      }
    });

    return value;
  }
}
