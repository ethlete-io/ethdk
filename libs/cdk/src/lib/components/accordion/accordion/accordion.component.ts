import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  booleanAttribute,
  contentChild,
  effect,
  input,
  model,
  untracked,
} from '@angular/core';

import { ACCORDION_COMPONENT } from './accordion.component.constants';
import { ACCORDION_HINT_WRAPPER_DIRECTIVE } from './accordion-hint-wrapper.directive';
import { ACCORDION_LABEL_WRAPPER_DIRECTIVE } from './accordion-label-wrapper.directive';
import { AccordionLabelDirective } from './accordion-label.directive';
import { CHEVRON_ICON } from '../../icons/chevron-icon';
import { IconDirective } from '../../icons/icon.directive';
import { PortalModule } from '@angular/cdk/portal';
import { accordionAnimations } from './accordion.component.animations';
import { provideIcons } from '../../icons/icon-provider';
import { toObservable } from '@angular/core/rxjs-interop';

let accordionId = 0;

@Component({
  selector: 'et-accordion',
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION_COMPONENT, useExisting: AccordionComponent }, provideIcons(CHEVRON_ICON)],
  imports: [AccordionLabelDirective, PortalModule, IconDirective],
  animations: [accordionAnimations.animateOpenClose],
  host: {
    class: 'et-accordion',
  },
})
export class AccordionComponent {
  isOpenByDefault = input(false, { transform: booleanAttribute });
  disabled = input(false, { transform: booleanAttribute });
  label = input('');
  isOpen = model(false);
  isOpen$ = toObservable(this.isOpen);

  templateLabel = contentChild(ACCORDION_LABEL_WRAPPER_DIRECTIVE);
  templateHint = contentChild(ACCORDION_HINT_WRAPPER_DIRECTIVE);

  readonly ID = `et-accordion-${accordionId++}`;
  readonly BODY_ID = `${this.ID}-body`;
  readonly HEADER_ID = `${this.ID}-header`;

  constructor() {
    const ref = effect(() => {
      const isOpenByDefault = this.isOpenByDefault();

      untracked(() => {
        this.isOpen.set(isOpenByDefault);
        ref.destroy();
      });
    });
  }

  toggleAccordionOpen() {
    this.isOpen.set(!this.isOpen());
  }

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }
}
