import { TemplatePortal } from '@angular/cdk/portal';
import {
  Component,
  ContentChild,
  InjectionToken,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  booleanAttribute,
  inject,
} from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { Subject } from 'rxjs';
import { TAB_CONTENT } from '../inline-tab-content';
import { InlineTabLabelDirective, TAB, TAB_LABEL } from '../inline-tab-label';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TAB_GROUP = new InjectionToken<unknown>('TAB_GROUP');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-inline-tab',
  templateUrl: 'inline-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: TAB, useExisting: InlineTabComponent }],
  host: {
    class: 'et-inline-tab et-legacy',
  },
})
export class InlineTabComponent implements OnInit, OnChanges, OnDestroy {
  private _viewContainerRef = inject(ViewContainerRef);
  _closestTabGroup = inject(TAB_GROUP, { optional: true });

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
