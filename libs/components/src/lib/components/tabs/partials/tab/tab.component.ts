import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  InjectionToken,
  Inject,
  Optional,
} from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { Subject } from 'rxjs';
import { TAB_CONTENT } from '../tab-content';
import { TAB, TabLabelDirective, TAB_LABEL } from '../tab-label';

export const TAB_GROUP = new InjectionToken<unknown>('TAB_GROUP');

@Component({
  selector: 'et-tab',
  templateUrl: 'tab.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: TAB, useExisting: TabComponent }],
  standalone: true,
  host: {
    class: 'et-tab',
  },
})
export class TabComponent implements OnInit, OnChanges, OnDestroy {
  @ContentChild(TAB_LABEL)
  get templateLabel(): TabLabelDirective {
    return this._templateLabel;
  }
  set templateLabel(value: TabLabelDirective) {
    this._setTemplateLabelInput(value);
  }
  protected _templateLabel!: TabLabelDirective;

  @ContentChild(TAB_CONTENT, { read: TemplateRef, static: true })
  _explicitContent!: TemplateRef<unknown>;

  @ViewChild(TemplateRef, { static: true })
  _implicitContent!: TemplateRef<unknown>;

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('label')
  textLabel = '';

  @Input('aria-label')
  ariaLabel!: string;

  @Input('aria-labelledby')
  ariaLabelledby!: string;

  @Input()
  labelClass: NgClassType;

  @Input()
  bodyClass: NgClassType;

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  private _contentPortal: TemplatePortal | null = null;

  get content(): TemplatePortal | null {
    return this._contentPortal;
  }

  readonly _stateChanges = new Subject<void>();

  position: number | null = null;

  origin: number | null = null;

  isActive = false;

  constructor(
    private _viewContainerRef: ViewContainerRef,
    @Inject(TAB_GROUP) @Optional() public _closestTabGroup: unknown,
  ) {}

  ngOnInit(): void {
    this._contentPortal = new TemplatePortal(this._explicitContent || this._implicitContent, this._viewContainerRef);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['textLabel'] || changes['disabled']) {
      this._stateChanges.next();
    }
  }

  ngOnDestroy(): void {
    this._stateChanges.complete();
  }

  protected _setTemplateLabelInput(value: TabLabelDirective | undefined) {
    if (value && value._closestTab === this) {
      this._templateLabel = value;
    }
  }
}
