import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorThemedDirective, ProvideThemeDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../spinner/spinner.component';
import { ButtonStylesDirective } from './button-styles.directive';
import { BUTTON_ICON_ALIGNMENTS, BUTTON_SIZES, ButtonIconAlignment, ButtonSize } from './button.component';
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
        <et-spinner class="et-button-loader-spinner" diameter="16" strokeWidth="2" />
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
    ColorThemedDirective,
    FocusRingDirective,
    {
      directive: ProvideThemeDirective,
      inputs: ['etProvideTheme:theme', 'etProvideAltTheme:altTheme'],
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
}
