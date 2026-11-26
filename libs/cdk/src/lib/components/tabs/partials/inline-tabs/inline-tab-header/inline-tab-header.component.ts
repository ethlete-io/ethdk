import {
  AfterContentChecked,
  AfterContentInit,
  Component,
  ContentChildren,
  forwardRef,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { TypedQueryList } from '@ethlete/core';
import { ScrollableComponent } from '../../../../scrollable/components/scrollable';
import { ActiveTabUnderlineBarManager, ActiveTabUnderlineDirective, PaginatedTabHeaderDirective } from '../../../utils';
import { InlineTabLabelWrapperDirective } from '../inline-tab-label-wrapper';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-inline-tab-header',
  templateUrl: 'inline-tab-header.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollableComponent],
  host: {
    class: 'et-inline-tab-header et-legacy',
  },
})
export class InlineTabHeaderComponent
  extends PaginatedTabHeaderDirective
  implements AfterContentChecked, AfterContentInit, OnDestroy
{
  @ContentChildren(InlineTabLabelWrapperDirective, { descendants: false })
  _items!: TypedQueryList<InlineTabLabelWrapperDirective>;

  @ViewChild(ScrollableComponent, { static: true })
  _scrollable!: ScrollableComponent;

  @ContentChildren(forwardRef(() => ActiveTabUnderlineDirective), { descendants: true })
  _inkBars!: TypedQueryList<ActiveTabUnderlineDirective>;

  _activeTabUnderlineManager?: ActiveTabUnderlineBarManager;

  override ngAfterContentInit() {
    this._activeTabUnderlineManager = new ActiveTabUnderlineBarManager(this._inkBars);
    super.ngAfterContentInit();
  }

  protected _itemSelected(event: KeyboardEvent) {
    event.preventDefault();
  }
}
