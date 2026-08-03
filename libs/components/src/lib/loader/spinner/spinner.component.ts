import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';

const BASE_STROKE_WIDTH = 10;

@Component({
  selector: 'et-spinner',
  template: `
    <ng-template #circle>
      <svg
        [attr.viewBox]="viewBox()"
        class="et-spinner-circle-graphic"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <circle
          [attr.r]="circleRadius()"
          [style.stroke-dasharray.px]="strokeCircumference()"
          [style.stroke-dashoffset.px]="strokeCircumference() / 2"
          [style.stroke-width.%]="circleStrokeWidth()"
          cx="50%"
          cy="50%"
        />
      </svg>
    </ng-template>

    @if (track()) {
      <div class="et-spinner-track-container" aria-hidden="true">
        <svg
          [attr.viewBox]="viewBox()"
          class="et-spinner-track-graphic"
          xmlns="http://www.w3.org/2000/svg"
          focusable="false"
        >
          <circle
            [attr.r]="circleRadius()"
            [style.stroke-dasharray.px]="strokeCircumference()"
            [style.stroke-width.%]="circleStrokeWidth()"
            class="et-spinner-track-circle"
            cx="50%"
            cy="50%"
          />
        </svg>
      </div>
    }

    @if (determinate()) {
      <svg
        [attr.viewBox]="viewBox()"
        class="et-spinner-determinate-graphic"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        aria-hidden="true"
      >
        <circle
          [attr.r]="circleRadius()"
          [style.stroke-dasharray.px]="strokeCircumference()"
          [style.stroke-dashoffset.px]="determinateDashOffset()"
          [style.stroke-width.%]="circleStrokeWidth()"
          class="et-spinner-determinate-circle"
          cx="50%"
          cy="50%"
        />
      </svg>
    } @else {
      <div class="et-spinner-indeterminate-container" aria-hidden="true">
        <div class="et-spinner-layer">
          <div class="et-spinner-circle-clipper et-spinner-circle-left">
            <ng-container [ngTemplateOutlet]="circle" />
          </div>
          <div class="et-spinner-gap-patch">
            <ng-container [ngTemplateOutlet]="circle" />
          </div>
          <div class="et-spinner-circle-clipper et-spinner-circle-right">
            <ng-container [ngTemplateOutlet]="circle" />
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './spinner.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-spinner',
    '[class.et-spinner--determinate]': 'determinate()',
    '[class.et-spinner--themed]': 'hasExplicitColor()',
    '[style.--et-spinner-size.px]': 'diameter()',
    '[style.--et-spinner-stroke-width.px]': 'strokeWidth()',
    role: 'progressbar',
    '[attr.aria-valuenow]': 'determinate() ? clampedValue() : null',
    '[attr.aria-valuemin]': 'determinate() ? 0 : null',
    '[attr.aria-valuemax]': 'determinate() ? 100 : null',
  },
})
export class SpinnerComponent {
  private provideColor = inject(ProvideColorDirective);

  public diameter = input(18, { transform: numberAttribute });
  public strokeWidth = input(2.25, { transform: numberAttribute });
  public track = input(false, { transform: booleanAttribute });
  public value = input(0, { transform: numberAttribute });
  public determinate = input(false, { transform: booleanAttribute });

  /**
   * Whether `color` was set on this spinner. The theme colour is deliberately gated on the input rather than
   * applied whenever a colour scope resolves: a spinner without `color` must keep inheriting `currentColor`
   * from its context (a button's label, muted body text), even when it sits inside an ancestor `et-color--*`
   * scope.
   */
  protected hasExplicitColor = computed(() => (this.provideColor.color() ?? null) !== null);

  public circleRadius = computed(() => Math.max(1, (this.diameter() - BASE_STROKE_WIDTH) / 2));

  public normalizedStrokeWidth = computed(() => (this.strokeWidth() / this.diameter()) * 100);

  public viewBox = computed(() => {
    const diameter = this.circleRadius() * 2 + this.strokeWidth();

    return `0 0 ${diameter} ${diameter}`;
  });

  public strokeCircumference = computed(() => 2 * Math.PI * this.circleRadius());

  public circleStrokeWidth = computed(() => this.normalizedStrokeWidth());

  public clampedValue = computed(() => Math.max(0, Math.min(100, this.value())));

  public determinateDashOffset = computed(() => {
    const circumference = this.strokeCircumference();

    return circumference - (this.clampedValue() / 100) * circumference;
  });
}
