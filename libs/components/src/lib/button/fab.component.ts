import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { ProvideThemeDirective } from '@ethlete/core';
import { BUTTON_SIZES, ButtonSize } from './button.component';
import { ButtonDirective } from './headless';

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

    <ng-template #iconTpl>
      <ng-content select="[etIcon]" />
    </ng-template>
  `,
  styleUrl: './fab.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'type', 'pressed'],
    },
    {
      directive: ProvideThemeDirective,
      inputs: ['etProvideTheme:theme', 'etProvideAltTheme:altTheme'],
    },
  ],
  host: {
    class: 'et-fab',
    '[attr.data-size]': 'size()',
    '[attr.data-expanded]': 'expandedAttr()',
    '[attr.data-icon-alignment]': 'iconAlignment()',
  },
})
export class FabComponent {
  size = input<ButtonSize>(BUTTON_SIZES.MD);
  expanded = input(false, { transform: booleanAttribute });
  iconAlignment = input<'start' | 'end'>('start');

  expandedAttr = computed(() => (this.expanded() ? true : null));
}
