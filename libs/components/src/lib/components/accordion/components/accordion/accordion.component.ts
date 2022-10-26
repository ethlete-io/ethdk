import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { PortalModule } from '@angular/cdk/portal';
import { AsyncPipe, NgClass, NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  InjectionToken,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { ChevronIconComponent } from '../../../scrollable';
import {
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
  ACCORDION_HINT_WRAPPER,
  ACCORDION_LABEL_WRAPPER,
} from '../../partials';
import { accordionAnimations } from './accordion.component.animations';

export const ACCORDION = new InjectionToken<AccordionComponent>('Accordion');

let accordionId = 0;

@Component({
  selector: 'et-accordion',
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  providers: [{ provide: ACCORDION, useExisting: AccordionComponent }],
  imports: [
    LetDirective,
    AsyncPipe,
    NgClass,
    AccordionLabelDirective,
    PortalModule,
    NgIf,
    NgTemplateOutlet,
    ChevronIconComponent,
  ],
  animations: [accordionAnimations.animateOpenClose],
  host: {
    class: 'et-accordion',
  },
})
export class AccordionComponent implements OnInit {
  private _id = `et-accordion-${accordionId++}`;

  @Input()
  get isOpenByDefault(): boolean {
    return this._isOpenByDefault;
  }
  set isOpenByDefault(value: BooleanInput) {
    this._isOpenByDefault = coerceBooleanProperty(value);
  }
  private _isOpenByDefault = false;

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  @ContentChild(ACCORDION_LABEL_WRAPPER)
  protected templateLabel!: AccordionLabelWrapperDirective;

  @ContentChild(ACCORDION_HINT_WRAPPER)
  protected templateHint!: AccordionHintWrapperDirective;

  @Input()
  label = '';

  bodyId = `${this._id}-body`;
  headerId = `${this._id}-header`;

  isFirst = false;
  isLast = false;

  isOpen$ = new BehaviorSubject(false);

  ngOnInit(): void {
    this.isOpen$.next(this.isOpenByDefault);
  }

  toggleAccordionOpen() {
    this.isOpen$.next(!this.isOpen$.value);
  }

  open() {
    this.isOpen$.next(true);
  }

  close() {
    this.isOpen$.next(false);
  }
}
