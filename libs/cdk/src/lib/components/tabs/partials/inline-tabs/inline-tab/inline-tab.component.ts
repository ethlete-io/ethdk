import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  Inject,
  InjectionToken,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  booleanAttribute,
} from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { Subject } from 'rxjs';
import { TAB_CONTENT } from '../inline-tab-content';
import { InlineTabLabelDirective, TAB, TAB_LABEL } from '../inline-tab-label';

export const TAB_GROUP = new InjectionToken<unknown>('TAB_GROUP');

@Component({
  selector: 'et-inline-tab',
  templateUrl: 'inline-tab.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: TAB, useExisting: InlineTabComponent }],
  standalone: true,
  host: {
    class: 'et-inline-tab',
  },
})
export class InlineTabComponent implements OnInit, OnChanges, OnDestroy {
  @ContentChild(TAB_LABEL)
  get templateLabel(): InlineTabLabelDirective {
    return this._templateLabel;
  }
  set templateLabel(value: InlineTabLabelDirective) {
    this._setTemplateLabelInput(value);
  }
  protected _templateLabel!: InlineTabLabelDirective;

  @Input({ transform: booleanAttribute })
  fitUnderlineToContent = false;

  @ContentChild(TAB_CONTENT, { read: TemplateRef, static: true })
  _explicitContent!: TemplateRef<unknown>;

  @ViewChild(TemplateRef, { static: true })
  _implicitContent!: TemplateRef<unknown>;

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

  @Input({ transform: booleanAttribute })
  disabled = false;

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

  protected _setTemplateLabelInput(value: InlineTabLabelDirective | undefined) {
    if (value && value._closestTab === this) {
      this._templateLabel = value;
    }
  }
}
