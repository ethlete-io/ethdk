import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, injectHostElement } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import { BUTTON_SIZES, BUTTON_SPINNER_CONFIG, BUTTON_VARIANTS, ButtonSize, ButtonVariant } from './button.types';
import { ButtonColorDirective, ButtonDirective } from './headless';

const warnUnmarkedIconButtonContent = (host: HTMLElement, iconSlot: HTMLElement) => {
  const unmarked = Array.from(iconSlot.childNodes).filter((node) =>
    node instanceof Element ? !node.matches('[etIcon], .et-icon') : node.nodeType === 3 && !!node.textContent?.trim(),
  );

  if (!unmarked.length) return;

  console.warn(
    '[et-icon-button] Content without the etIcon attribute is not sized by the icon button. ' +
      'Add etIcon to the icon element, or bind the icon with [etIcon]="name".',
    { element: host, content: unmarked },
  );
};

const PRESSED_VARIANT_MAP: Record<ButtonVariant, string> = {
  filled: 'transparent',
  outline: 'filled',
  tonal: 'filled',
  transparent: 'tonal',
};

@Component({
  selector: '[et-icon-button]',
  template: `
    <div #iconSlot class="et-icon-button-icon">
      <ng-content select="[etIcon]" />
      <ng-content />
    </div>

    @if (buttonDir.isLoading()) {
      <div class="et-button-loader" aria-hidden="true">
        <et-spinner
          [diameter]="spinnerConfig().diameter"
          [strokeWidth]="spinnerConfig().strokeWidth"
          [track]="buttonDir.hasProgress()"
          [value]="buttonDir.currentProgress()"
          class="et-button-loader-spinner"
        />
      </div>
    }
  `,
  styleUrl: './icon-button.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent],
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'loading', 'progress', 'type', 'pressed', 'emitAriaPressed'],
    },
    ButtonStylesDirective,
    ColorInteractiveDirective,
    FocusRingDirective,
    {
      directive: ButtonColorDirective,
      inputs: ['color', 'pressedColor'],
    },
  ],
  host: {
    class: 'et-icon-button',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.data-pressed-variant]': 'pressedVariant()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class IconButtonComponent {
  protected buttonDir = inject(ButtonDirective);
  private hostElement = injectHostElement();

  public variant = input<ButtonVariant>(BUTTON_VARIANTS.TRANSPARENT);
  public size = input<ButtonSize>(BUTTON_SIZES.MD);

  private iconSlot = viewChild.required<ElementRef<HTMLElement>>('iconSlot');

  public canAnimate = createCanAnimateSignal();

  public spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);

  public pressedVariant = computed(() => (this.buttonDir.pressed() ? PRESSED_VARIANT_MAP[this.variant()] : null));

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => warnUnmarkedIconButtonContent(this.hostElement, this.iconSlot().nativeElement));
    }
  }
}
