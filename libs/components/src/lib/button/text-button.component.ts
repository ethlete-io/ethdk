import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ColoredDirective, ProvideColorDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import {
  BUTTON_ICON_ALIGNMENTS,
  BUTTON_SIZES,
  BUTTON_SPINNER_CONFIG,
  ButtonIconAlignment,
  ButtonSize,
} from './button.component';
import { ButtonDirective } from './headless';

@Component({
  selector: '[et-text-button]',
  template: `
    @if (iconAlignment() === 'start') {
      <div class="et-text-button-icon">
        <ng-container *ngTemplateOutlet="iconTpl" />
      </div>
    }

    <div class="et-text-button-contents">
      <ng-content />
    </div>

    @if (iconAlignment() === 'end') {
      <div class="et-text-button-icon">
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
  styleUrl: './text-button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SpinnerComponent],
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'loading', 'type'],
    },
    ButtonStylesDirective,
    ColoredDirective,
    FocusRingDirective,
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color', 'etProvideAltColor:altColor'],
    },
  ],
  host: {
    class: 'et-text-button',
    '[attr.data-icon-alignment]': 'iconAlignment()',
    '[attr.data-size]': 'size()',
  },
})
export class TextButtonComponent {
  protected buttonDir = inject(ButtonDirective);

  size = input<ButtonSize>(BUTTON_SIZES.MD);
  iconAlignment = input<ButtonIconAlignment>(BUTTON_ICON_ALIGNMENTS.START);

  spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);
}
