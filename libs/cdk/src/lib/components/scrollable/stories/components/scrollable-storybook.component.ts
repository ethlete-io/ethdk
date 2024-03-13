import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ScrollableComponent } from '../../components/scrollable';
import { ScrollableImports } from '../../scrollable.imports';
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
      [scrollableRole]="scrollableRole ?? null"
      [scrollableClass]="scrollableClass"
      [renderMasks]="renderMasks"
      [renderButtons]="renderButtons"
      [renderScrollbars]="renderScrollbars"
      [cursorDragScroll]="cursorDragScroll"
      [disableActiveElementScrolling]="disableActiveElementScrolling"
      [renderNavigation]="renderNavigation"
      [scrollMode]="scrollMode"
      [snap]="snap"
      [scrollMargin]="scrollMargin"
    >
      <button (click)="doClick(0)" class="scrollable-item">0</button>
      <button (click)="doClick(1)" class="scrollable-item">1</button>
      @if (makeScrollable) {
        <button (click)="doClick(2)" class="scrollable-item">2</button>
      }
      @if (makeScrollable) {
        <button (click)="doClick(3)" class="scrollable-item" etScrollableIsActiveChild="false">3</button>
      }
      @if (makeScrollable) {
        <button (click)="doClick(4)" class="scrollable-item" etScrollableIsActiveChild>4</button>
      }
      @if (makeScrollable) {
        <button (click)="doClick(5)" class="scrollable-item">5</button>
      }
      @if (makeScrollable) {
        <button (click)="doClick(6)" class="scrollable-item">6</button>
      }
    </et-scrollable>
  `,
  styles: [
    `
      .et-scrollable {
        margin-top: 20px;

        &[direction='vertical'] {
          width: min(80vw, 400px);

          .et-scrollable-container-outer {
            height: 250px;
          }
        }

        &[direction='vertical'][sticky-buttons='true'] {
          width: 200vw;
        }

        &[direction='horizontal'][sticky-buttons='true'] .et-scrollable-container {
          height: 500px;
        }
      }

      .et-scrollable-container {
        height: 100px;
        gap: 20px;
      }

      .scrollable-item {
        width: min(80vw, 400px);
        background-color: #ccc;
        height: 100px;
        outline: 1px solid red;
        outline-offset: -1px;
      }

      p {
        white-space: nowrap;
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
  imports: [AsyncPipe, ScrollableImports],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollableStorybookComponent {
  makeScrollable = true;

  @ViewChild(ScrollableComponent, { static: true })
  scrollable!: ScrollableComponent;

  @Input()
  itemSize: 'auto' | 'same' | 'full' = 'auto';

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
  renderNavigation = false;

  @Input()
  disableActiveElementScrolling = false;

  @Input()
  scrollMargin = 0;

  scrollToIndex(index: number) {
    this.scrollable.scrollToElementByIndex({ index });
  }

  doClick(item: number) {
    alert(item);
  }

  logState(state: unknown) {
    console.log(state);
  }
}
