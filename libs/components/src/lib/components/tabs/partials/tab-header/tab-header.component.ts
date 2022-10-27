import { Directionality } from '@angular/cdk/bidi';
import { ViewportRuler } from '@angular/cdk/scrolling';
import {
  AfterContentChecked,
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  NgZone,
  OnDestroy,
  Optional,
  QueryList,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { TabLabelWrapperDirective } from '../tab-label-wrapper';
import { PaginatedTabHeaderDirective } from '../../utils';
import { TabInkBarComponent } from '../tab-ink-bar';
import { ScrollableComponent } from '../../../scrollable';
import { ObserveContentDirective, ScrollObserverIgnoreTargetDirective } from '@ethlete/core';

@Component({
  selector: 'et-tab-header',
  templateUrl: 'tab-header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ScrollableComponent,
    TabInkBarComponent,
    NgClass,
    ObserveContentDirective,
    ScrollObserverIgnoreTargetDirective,
  ],
  host: {
    class: 'et-tab-header',
  },
})
export class TabHeaderComponent
  extends PaginatedTabHeaderDirective
  implements AfterContentChecked, AfterContentInit, OnDestroy
{
  @ContentChildren(TabLabelWrapperDirective, { descendants: false })
  _items!: QueryList<TabLabelWrapperDirective>;

  @ViewChild(TabInkBarComponent, { static: true })
  _inkBar!: TabInkBarComponent;

  @ViewChild(ScrollableComponent, { static: true })
  _scrollable!: ScrollableComponent;

  constructor(
    elementRef: ElementRef,
    changeDetectorRef: ChangeDetectorRef,
    viewportRuler: ViewportRuler,
    @Optional() dir: Directionality,
    ngZone: NgZone,
  ) {
    super(elementRef, changeDetectorRef, viewportRuler, dir, ngZone);
  }

  protected _itemSelected(event: KeyboardEvent) {
    event.preventDefault();
  }
}
