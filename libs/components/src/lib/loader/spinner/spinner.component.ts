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
import { clampProgress, progressOrNull } from '../clamp-progress';
import { injectLoaderName } from '../inject-loader-name';

const BASE_STROKE_WIDTH = 10;

/**
 * A circular loading indicator: determinate while `value` is bound, else indeterminate. Inherits `currentColor`
 * unless `color` is set. Its accessible name is the loader `loading` label; set an `aria-label` to name it more
 * specifically.
 *
 * @example
 * <et-spinner [value]="65" [track]="true" aria-label="Uploading" />
 */
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
          [style.stroke-width.%]="normalizedStrokeWidth()"
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
            [style.stroke-width.%]="normalizedStrokeWidth()"
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
          [style.stroke-width.%]="normalizedStrokeWidth()"
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
    '[attr.aria-label]': 'name()',
    '[attr.aria-valuenow]': 'determinate() ? clampedValue() : null',
    '[attr.aria-valuemin]': 'determinate() ? 0 : null',
    '[attr.aria-valuemax]': 'determinate() ? 100 : null',
  },
})
export class SpinnerComponent {
  private provideColor = inject(ProvideColorDirective);

  protected name = injectLoaderName();

  /** The size in px. @default 18 */
  public diameter = input(18, { transform: numberAttribute });

  /** The stroke width in px. @default 2.25 */
  public strokeWidth = input(2.25, { transform: numberAttribute });

  /** Render a background ring behind the stroke. @default false */
  public track = input(false, { transform: booleanAttribute });

  /**
   * The progress, 0-100 and clamped. Binding a number shows it instead of the indeterminate sweep and exposes it as
   * `aria-valuenow`; `null` or `undefined` keeps the spinner indeterminate. @default null
   */
  public value = input<number | null, number | string | null | undefined>(null, { transform: progressOrNull });

  protected determinate = computed(() => this.value() !== null);

  /**
   * Whether `color` was set on this spinner. The theme colour is deliberately gated on the input rather than
   * applied whenever a colour scope resolves: a spinner without `color` must keep inheriting `currentColor`
   * from its context (a button's label, muted body text), even when it sits inside an ancestor `et-color--*`
   * scope.
   */
  protected hasExplicitColor = computed(() => (this.provideColor.color() ?? null) !== null);

  protected circleRadius = computed(() => Math.max(1, (this.diameter() - BASE_STROKE_WIDTH) / 2));

  protected normalizedStrokeWidth = computed(() => (this.strokeWidth() / this.diameter()) * 100);

  protected viewBox = computed(() => {
    const diameter = this.circleRadius() * 2 + this.strokeWidth();

    return `0 0 ${diameter} ${diameter}`;
  });

  protected strokeCircumference = computed(() => 2 * Math.PI * this.circleRadius());

  protected clampedValue = computed(() => clampProgress(this.value() ?? 0));

  protected determinateDashOffset = computed(() => {
    const circumference = this.strokeCircumference();

    return circumference - (this.clampedValue() / 100) * circumference;
  });
}
