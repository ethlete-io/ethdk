import { PortalModule } from '@angular/cdk/portal';
import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  Input,
  OnInit,
  ViewEncapsulation,
  booleanAttribute,
} from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { ChevronIconComponent } from '../../../icons/chevron-icon';
import { ACCORDION_HINT_WRAPPER_DIRECTIVE, AccordionHintWrapperDirective } from '../../partials/accordion-hint-wrapper';
import { AccordionLabelDirective } from '../../partials/accordion-label';
import {
  ACCORDION_LABEL_WRAPPER_DIRECTIVE,
  AccordionLabelWrapperDirective,
} from '../../partials/accordion-label-wrapper';
import { accordionAnimations } from './accordion.component.animations';
import { ACCORDION_COMPONENT } from './accordion.component.constants';

let accordionId = 0;

@Component({
  selector: 'et-accordion',
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION_COMPONENT, useExisting: AccordionComponent }],
  imports: [LetDirective, AsyncPipe, AccordionLabelDirective, PortalModule, ChevronIconComponent],
  animations: [accordionAnimations.animateOpenClose],
  host: {
    class: 'et-accordion',
  },
})
export class AccordionComponent implements OnInit {
  private readonly _id = `et-accordion-${accordionId++}`;

  @Input({ transform: booleanAttribute })
  isOpenByDefault = false;

  @Input({ transform: booleanAttribute })
  disabled = false;

  @Input()
  label = '';

  @ContentChild(ACCORDION_LABEL_WRAPPER_DIRECTIVE)
  protected readonly templateLabel!: AccordionLabelWrapperDirective;

  @ContentChild(ACCORDION_HINT_WRAPPER_DIRECTIVE)
  protected readonly templateHint!: AccordionHintWrapperDirective;

  protected readonly bodyId = `${this._id}-body`;
  protected readonly headerId = `${this._id}-header`;

  _isFirst = false;
  _isLast = false;

  protected readonly _isOpen$ = new BehaviorSubject(false);

  get isOpen$() {
    return this._isOpen$.asObservable();
  }

  get isOpen() {
    return this._isOpen$.value;
  }

  ngOnInit(): void {
    this._isOpen$.next(this.isOpenByDefault);
  }

  toggleAccordionOpen() {
    this._isOpen$.next(!this._isOpen$.value);
  }

  open() {
    this._isOpen$.next(true);
  }

  close() {
    this._isOpen$.next(false);
  }
}
