import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  contentChild,
  input,
  numberAttribute,
} from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { SCROLLABLE_PLACEHOLDER_ITEM_TEMPLATE_TOKEN } from '../../directives/scrollable-placeholder-item-template';
import { SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN } from '../../directives/scrollable-placeholder-overlay-template';

@Component({
  selector: 'et-scrollable-placeholder',
  templateUrl: './scrollable-placeholder.component.html',
  styleUrl: './scrollable-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, NgClass],
  host: {
    class: 'et-scrollable-placeholder',
  },
})
export class ScrollablePlaceholderComponent {
  renderMasks = input(true, { transform: booleanAttribute });
  renderStartMask = input(false, { transform: booleanAttribute });
  renderEndMask = input(true, { transform: booleanAttribute });
  repeatContentCount = input(1, { transform: numberAttribute });
  scrollableClass = input<NgClassType>();

  repeat = computed(() => Array.from({ length: this.repeatContentCount() }));

  contentTemplate = contentChild.required(SCROLLABLE_PLACEHOLDER_ITEM_TEMPLATE_TOKEN, { read: TemplateRef });
  overlayTemplate = contentChild(SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN, { read: TemplateRef });
}
