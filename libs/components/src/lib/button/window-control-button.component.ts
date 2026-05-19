import { ChangeDetectionStrategy, Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import { ButtonDirective } from './headless';

export const WINDOW_CONTROL_BUTTON_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;

export type WindowControlButtonSize = (typeof WINDOW_CONTROL_BUTTON_SIZES)[keyof typeof WINDOW_CONTROL_BUTTON_SIZES];

export const WINDOW_CONTROL_BUTTON_KINDS = {
  DEFAULT: 'default',
  CLOSE: 'close',
} as const;

export type WindowControlButtonKind = (typeof WINDOW_CONTROL_BUTTON_KINDS)[keyof typeof WINDOW_CONTROL_BUTTON_KINDS];

const WINDOW_CONTROL_BUTTON_SPINNER_CONFIG = {
  [WINDOW_CONTROL_BUTTON_SIZES.SM]: { diameter: 12, strokeWidth: 2 },
  [WINDOW_CONTROL_BUTTON_SIZES.MD]: { diameter: 14, strokeWidth: 2 },
  [WINDOW_CONTROL_BUTTON_SIZES.LG]: { diameter: 16, strokeWidth: 2.5 },
} as const;

@Component({
  selector: '[et-window-control-button]',
  template: `
    <div class="et-window-control-button-icon">
      <ng-content />
    </div>

    @if (buttonDir.loading()) {
      <div class="et-button-loader" aria-hidden="true">
        <et-spinner
          [diameter]="spinnerConfig().diameter"
          [strokeWidth]="spinnerConfig().strokeWidth"
          class="et-button-loader-spinner"
        />
      </div>
    }
  `,
  styleUrl: './window-control-button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'loading', 'type', 'pressed'],
    },
    ButtonStylesDirective,
    ColorInteractiveDirective,
    FocusRingDirective,
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-window-control-button',
    '[attr.data-kind]': 'kind()',
    '[attr.data-size]': 'size()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class WindowControlButtonComponent {
  protected buttonDir = inject(ButtonDirective);

  public size = input<WindowControlButtonSize>(WINDOW_CONTROL_BUTTON_SIZES.MD);
  public kind = input<WindowControlButtonKind>(WINDOW_CONTROL_BUTTON_KINDS.DEFAULT);

  public canAnimate = createCanAnimateSignal();

  protected spinnerConfig = computed(() => WINDOW_CONTROL_BUTTON_SPINNER_CONFIG[this.size()]);
}
