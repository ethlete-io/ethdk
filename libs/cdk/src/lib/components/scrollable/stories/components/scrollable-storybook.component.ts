import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { IsActiveElementDirective, IsElementDirective, NgClassType } from '@ethlete/core';
import { ScrollableComponent } from '../../components';
import { ScrollableScrollMode } from '../../types';

@Component({
  selector: 'et-sb-scrollable',
  template: `
    <button (click)="makeScrollable = !makeScrollable" type="button">Toggle scrollable</button>

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
      [activeElementScrollMargin]="activeElementScrollMargin"
      [scrollMode]="scrollMode"
      [snap]="snap"
      [snapMargin]="snapMargin"
    >
      <div class="scrollable-item" etIsElement></div>
      <div class="scrollable-item" etIsElement></div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsElement></div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsActiveElement="false" etIsElement></div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsActiveElement etIsElement></div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsElement></div>
      <div *ngIf="makeScrollable" class="scrollable-item" etIsElement></div>
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
  activeElementScrollMargin = 40;

  @Input()
  snapMargin = 0;
}
