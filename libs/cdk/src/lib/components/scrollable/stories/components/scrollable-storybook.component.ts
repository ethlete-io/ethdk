import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewChild, ViewEncapsulation } from '@angular/core';
import { IsActiveElementDirective, IsElementDirective, NgClassType } from '@ethlete/core';
import { ScrollableComponent } from '../../components';
import { ScrollableScrollMode } from '../../types';

@Component({
  selector: 'et-sb-scrollable',
  template: `
    <button (click)="makeScrollable = !makeScrollable" type="button">Toggle scrollable</button>
    <button (click)="scrollToIndex(4)" type="button">Scroll to index 4</button>

    <et-scrollable
      [stickyButtons]="stickyButtons"
      [itemSize]="itemSize"
      [direction]="direction"
      [scrollableRole]="scrollableRole"
      [scrollableClass]="scrollableClass"
      [renderMasks]="renderMasks"
      [renderButtons]="renderButtons"
      [renderScrollbars]="renderScrollbars"
      [cursorDragScroll]="cursorDragScroll"
      [disableActiveElementScrolling]="disableActiveElementScrolling"
      [scrollMode]="scrollMode"
      [snap]="snap"
      [scrollMargin]="scrollMargin"
    >
      <div class="scrollable-item" etIsElement>0</div>
      <div class="scrollable-item" etIsElement>1</div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsElement>2</div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsActiveElement="false" etIsElement>3</div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsActiveElement etIsElement>4</div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsElement>5</div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsElement>6</div>
    </et-scrollable>
  `,
  styles: [
    `
      .et-scrollable {
        margin-top: 20px;
      }

      .et-scrollable-container {
        height: 100px;
        gap: 20px;
      }

      .scrollable-item {
        width: min(80vw, 400px);
        flex: 0 0 auto;
        height: 100%;
        background-color: #ccc;
        height: 98px;
        border: 1px solid red;
      }

      .scrollable-item:nth-child(2) {
        background-color: #aaa;
      }

      .scrollable-item:nth-child(3) {
        background-color: #888;
      }

      .scrollable-item:nth-child(4) {
        background-color: #666;
      }

      .scrollable-item:nth-child(5) {
        background-color: #444;
      }

      .scrollable-item:nth-child(6) {
        background-color: #222;
      }

      .scrollable-item:nth-child(7) {
        background-color: #000;
      }
    `,
  ],
  standalone: true,
  imports: [NgIf, AsyncPipe, ScrollableComponent, IsActiveElementDirective, IsElementDirective],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollableStorybookComponent {
  makeScrollable = true;

  @ViewChild(ScrollableComponent, { static: true })
  scrollable!: ScrollableComponent;

  @Input()
  itemSize: 'auto' | 'same' = 'auto';

  @Input()
  direction: 'horizontal' | 'vertical' = 'horizontal';

  @Input()
  scrollableRole?: string;

  @Input()
  scrollableClass?: NgClassType;

  @Input()
  renderMasks = true;

  @Input()
  scrollMode: ScrollableScrollMode = 'container';

  @Input()
  renderButtons = true;

  @Input()
  renderScrollbars = false;

  @Input()
  stickyButtons = false;

  @Input()
  cursorDragScroll = false;

  @Input()
  snap = false;

  @Input()
  disableActiveElementScrolling = false;

  @Input()
  scrollMargin = 0;

  scrollToIndex(index: number) {
    this.scrollable.scrollToElementByIndex({ index });
  }
}
