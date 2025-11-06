import {
  AfterContentChecked,
  AfterContentInit,
  ChangeDetectionStrategy,
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

@Component({
  selector: 'et-inline-tab-header',
  templateUrl: 'inline-tab-header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollableComponent],
  host: {
    class: 'et-inline-tab-header',
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
