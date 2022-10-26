import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { PortalModule } from '@angular/cdk/portal';
import { AsyncPipe, NgClass, NgIf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ContentChild, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { ChevronIconComponent } from '../../../scrollable';
import {
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
  ACCORDION_HINT_WRAPPER_DIRECTIVE,
  ACCORDION_LABEL_WRAPPER_DIRECTIVE,
} from '../../partials';
import { accordionAnimations } from './accordion.component.animations';
import { ACCORDION_COMPONENT } from './accordion.component.constants';

let accordionId = 0;

@Component({
  selector: 'et-accordion',
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  providers: [{ provide: ACCORDION_COMPONENT, useExisting: AccordionComponent }],
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
  private readonly _id = `et-accordion-${accordionId++}`;

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
