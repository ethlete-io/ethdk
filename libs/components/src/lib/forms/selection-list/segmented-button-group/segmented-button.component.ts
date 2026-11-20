import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  ColorInteractiveDirective,
  createCanAnimateSignal,
  createFlipAnimation,
  injectHostElement,
  RuntimeError,
} from '@ethlete/core';
import { ScrollableActiveChildRef, ScrollableDirective } from '../../../scrollable/headless/scrollable.directive';
import { SELECTION_LIST_TOKEN, SelectionOptionDirective } from '../headless';
import { SELECTION_LIST_ERROR_CODES } from '../selection-list-errors';
import { SegmentedButtonGroupComponent } from './segmented-button-group.component';

@Component({
  selector: 'et-segmented-button',
  template: `
    <div #background class="et-segmented-button-bg"></div>
    <span [attr.id]="optionDirective.labelId" class="et-segmented-button-label">
      <ng-content />
    </span>
  `,
  styleUrl: './segmented-button.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: SelectionOptionDirective,
      inputs: ['value', 'checked', 'disabled'],
      outputs: ['checkedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-segmented-button',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class SegmentedButtonComponent {
  public optionDirective = inject(SelectionOptionDirective);
  private group = inject(SegmentedButtonGroupComponent, { optional: true });
  private scrollable = inject(ScrollableDirective, { optional: true });
  private backgroundRef = viewChild.required<ElementRef<HTMLElement>>('background');

  public canAnimate = createCanAnimateSignal();

  constructor() {
    const hostEl = injectHostElement();

    if (ngDevMode) {
      const list = inject(SELECTION_LIST_TOKEN, { optional: true });

      if (!list) {
        throw new RuntimeError(
          SELECTION_LIST_ERROR_CODES.SEGMENTED_BUTTON_OUTSIDE_GROUP,
          '[SegmentedButtonComponent] et-segmented-button must be placed inside an et-segmented-button-group.',
          { element: hostEl },
        );
      }
    }

    inject(DestroyRef).onDestroy(() => {
      const group = this.group;

      if (group && group.lastActiveBackgroundElement()?.parentElement === hostEl) {
        group.lastActiveBackgroundElement.set(null);
      }
    });

    const scrollable = this.scrollable;

    if (scrollable) {
      const ref: ScrollableActiveChildRef = {
        elementRef: new ElementRef(hostEl),
        isActiveChildEnabled: this.optionDirective.checked,
      };

      scrollable.registerActiveChild(ref);
      inject(DestroyRef).onDestroy(() => scrollable.unregisterActiveChild(ref));

      let isFirstRun = true;

      effect(() => {
        const isChecked = this.optionDirective.checked();

        if (isFirstRun) {
          isFirstRun = false;

          return;
        }

        if (isChecked) {
          untracked(() => scrollable.scrollToElement({ element: hostEl, origin: 'center' }));
        }
      });
    }

    effect(() => {
      const group = this.group;

      if (!group || !this.optionDirective.checked()) {
        return;
      }

      const backgroundEl = this.backgroundRef().nativeElement;
      const previousOriginEl = untracked(() => group.lastActiveBackgroundElement());

      untracked(() => group.lastActiveBackgroundElement.set(backgroundEl));

      if (
        !previousOriginEl ||
        previousOriginEl === backgroundEl ||
        !previousOriginEl.isConnected ||
        !untracked(() => this.canAnimate.state())
      ) {
        return;
      }

      const flip = createFlipAnimation({
        element: backgroundEl,
        originElement: previousOriginEl,
        duration: 250,
        easing: 'cubic-bezier(0.35, 0.25, 0.2, 1)',
      });

      flip.play();
    });
  }
}
