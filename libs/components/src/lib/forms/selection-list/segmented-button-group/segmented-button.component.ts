import { Component, effect, ElementRef, inject, untracked, viewChild, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, createFlipAnimation } from '@ethlete/core';
import { SelectionOptionDirective } from '../headless';
import { SegmentedButtonGroupComponent } from './segmented-button-group.component';

@Component({
  selector: 'et-segmented-button',
  template: `
    <div #background class="et-segmented-button-bg"></div>
    <ng-content />
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
  private backgroundRef = viewChild.required<ElementRef<HTMLElement>>('background');

  public canAnimate = createCanAnimateSignal();

  constructor() {
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
