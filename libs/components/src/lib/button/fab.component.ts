import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import {
  BUTTON_ICON_ALIGNMENTS,
  BUTTON_SIZES,
  BUTTON_SPINNER_CONFIG,
  BUTTON_VARIANTS,
  ButtonIconAlignment,
  ButtonSize,
} from './button.component';
import { ButtonDirective } from './headless';

type FabVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];

@Component({
  selector: '[et-fab]',
  template: `
    @if (iconAlignment() === 'start') {
      <div class="et-fab-icon">
        <ng-container *ngTemplateOutlet="iconTpl" />
      </div>
    }
    <div class="et-fab-contents">
      <div class="et-fab-contents-inner"><ng-content /></div>
    </div>
    @if (iconAlignment() === 'end') {
      <div class="et-fab-icon">
        <ng-container *ngTemplateOutlet="iconTpl" />
      </div>
    }

    @if (buttonDir.loading()) {
      <div class="et-button-loader" aria-hidden="true">
        <et-spinner
          [diameter]="spinnerConfig().diameter"
          [strokeWidth]="spinnerConfig().strokeWidth"
          class="et-button-loader-spinner"
        />
      </div>
    }

    <ng-template #iconTpl>
      <ng-content select="[etIcon]" />
    </ng-template>
  `,
  styleUrl: './fab.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SpinnerComponent],
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'loading', 'type'],
    },
    ButtonStylesDirective,
    FocusRingDirective,
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color', 'etProvideAltColor:altColor'],
    },
  ],
  host: {
    class: 'et-fab',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.data-expanded]': 'expandedAttr()',
    '[attr.data-icon-alignment]': 'iconAlignment()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class FabComponent {
  protected buttonDir = inject(ButtonDirective);

  variant = input<FabVariant>(BUTTON_VARIANTS.FILLED);
  size = input<ButtonSize>(BUTTON_SIZES.MD);
  expanded = input(false, { transform: booleanAttribute });
  iconAlignment = input<ButtonIconAlignment>(BUTTON_ICON_ALIGNMENTS.START);

  canAnimate = createCanAnimateSignal();

  spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);

  expandedAttr = computed(() => (this.expanded() ? true : null));
}
