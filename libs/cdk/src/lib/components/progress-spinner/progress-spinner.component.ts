import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  Input,
  ViewEncapsulation,
  booleanAttribute,
  inject,
  numberAttribute,
} from '@angular/core';
import { clamp } from '@ethlete/core';

export type ProgressSpinnerMode = 'determinate' | 'indeterminate';

export interface ProgressSpinnerDefaultOptions {
  diameter?: number;
  strokeWidth?: number;
}

export const PROGRESS_SPINNER_DEFAULT_OPTIONS = new InjectionToken<ProgressSpinnerDefaultOptions>(
  'PROGRESS_SPINNER_DEFAULT_OPTIONS',
  {
    providedIn: 'root',
    factory: PROGRESS_SPINNER_DEFAULT_OPTIONS_FACTORY,
  },
);

export function PROGRESS_SPINNER_DEFAULT_OPTIONS_FACTORY(): ProgressSpinnerDefaultOptions {
  return { diameter: BASE_SIZE, strokeWidth: BASE_STROKE_WIDTH };
}

const BASE_SIZE = 100;
const BASE_STROKE_WIDTH = 10;

@Component({
  selector: 'et-progress-spinner, et-spinner',
  templateUrl: './progress-spinner.component.html',
  styleUrls: ['./progress-spinner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-progress-spinner',
    role: 'progressbar',
    tabindex: '-1',
    '[class.et-circular-progress--indeterminate]': 'mode === "indeterminate"',
    '[class.et-progress-spinner--multi-color]': 'multiColor',
    '[style.width.px]': 'diameter',
    '[style.height.px]': 'diameter',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    '[attr.aria-valuenow]': 'mode === "determinate" ? value : null',
    '[attr.mode]': 'mode',
  },
  imports: [NgTemplateOutlet],
})
export class ProgressSpinnerComponent {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _defaults = inject<ProgressSpinnerDefaultOptions>(PROGRESS_SPINNER_DEFAULT_OPTIONS);

  @Input({ transform: booleanAttribute })
  multiColor = false;

  @Input()
  mode: ProgressSpinnerMode =
    this._elementRef.nativeElement.nodeName.toLowerCase() === 'et-spinner' ? 'indeterminate' : 'determinate';

  @Input()
  get value(): number {
    return this.mode === 'determinate' ? this._value : 0;
  }
  set value(v: unknown) {
    this._value = clamp(numberAttribute(v, 0));
  }
  private _value = 0;

  @Input({ transform: numberAttribute })
  diameter = BASE_SIZE;

  @Input()
  get strokeWidth(): number {
    return this._strokeWidth ?? this.diameter / 10;
  }
  set strokeWidth(value: unknown) {
    this._strokeWidth = numberAttribute(value);
  }
  private _strokeWidth: number | null = null;

  constructor() {
    if (this._defaults) {
      if (this._defaults.diameter) {
        this.diameter = this._defaults.diameter;
      }

      if (this._defaults.strokeWidth) {
        this.strokeWidth = this._defaults.strokeWidth;
      }
    }
  }

  protected _circleRadius() {
    return (this.diameter - BASE_STROKE_WIDTH) / 2;
  }

  protected _viewBox() {
    const viewBox = this._circleRadius() * 2 + this.strokeWidth;
    return `0 0 ${viewBox} ${viewBox}`;
  }

  protected _strokeCircumference() {
    return 2 * Math.PI * this._circleRadius();
  }

  protected _strokeDashOffset() {
    if (this.mode === 'determinate') {
      return (this._strokeCircumference() * (100 - this._value)) / 100;
    }
    return null;
  }

  protected _circleStrokeWidth() {
    return (this.strokeWidth / this.diameter) * 100;
  }
}
