import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { NgClass, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  inject,
  Input,
  OnInit,
  Output,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { LetDirective, NgClassType, ObserveContentDirective } from '@ethlete/core';
import { DestroyService } from '../../../../services';
import { BehaviorSubject, takeUntil, tap } from 'rxjs';
import {
  ChevronIconComponent,
  CursorDragScrollDirective,
  ObserveScrollStateDirective,
  ScrollableScrollState,
} from '../../partials';

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CursorDragScrollDirective,
    ObserveScrollStateDirective,
    NgClass,
    NgIf,
    LetDirective,
    ChevronIconComponent,
    ObserveContentDirective,
  ],
  host: {
    class: 'et-scrollable',
  },
})
export class ScrollableComponent implements OnInit {
  private readonly _destroy$ = inject(DestroyService).destroy$;
  private readonly _renderer = inject(Renderer2);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input()
  @HostBinding('attr.item-size')
  itemSize: 'auto' | 'same' = 'auto';

  @Input()
  @HostBinding('attr.direction')
  direction: 'horizontal' | 'vertical' = 'horizontal';

  @Input()
  scrollableRole?: string;

  @Input()
  scrollableClass?: NgClassType;

  @Input()
  get renderMasks(): boolean {
    return this._renderMasks;
  }
  set renderMasks(value: BooleanInput) {
    this._renderMasks = coerceBooleanProperty(value);
  }
  private _renderMasks = true;

  @Input()
  get renderButtons(): boolean {
    return this._renderButtons;
  }
  set renderButtons(value: BooleanInput) {
    this._renderButtons = coerceBooleanProperty(value);
  }
  private _renderButtons = true;

  @Input()
  @HostBinding('attr.render-scrollbars')
  get renderScrollbars(): boolean {
    return this._renderScrollbars;
  }
  set renderScrollbars(value: BooleanInput) {
    this._renderScrollbars = coerceBooleanProperty(value);
  }
  private _renderScrollbars = false;

  @Output()
  readonly contentChanged = new EventEmitter<MutationRecord[]>();

  @ViewChild('scrollable', { static: true })
  scrollable!: ElementRef<HTMLElement>;

  protected readonly scrollState$ = new BehaviorSubject<ScrollableScrollState | null>(null);

  ngOnInit(): void {
    this.scrollState$
      .pipe(
        tap((state) => {
          if (!state) {
            return;
          }

          const element = this._elementRef.nativeElement;

          this._renderer.setAttribute(element, 'at-start', state.isAtStart.toString());
          this._renderer.setAttribute(element, 'at-end', state.isAtEnd.toString());
          this._renderer.setAttribute(element, 'can-scroll', state.canScroll.toString());
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  protected _scrollStateChanged(scrollState: ScrollableScrollState) {
    this.scrollState$.next(scrollState);
  }

  protected _contentChanged(data: MutationRecord[]) {
    this.contentChanged.emit(data);
  }

  protected scrollOneContainerSizeToStart() {
    this.scrollOneContainerSize('start');
  }

  protected scrollOneContainerSizeToEnd() {
    this.scrollOneContainerSize('end');
  }

  scrollOneContainerSize(direction: 'start' | 'end') {
    const scrollElement = this.scrollable.nativeElement;
    const parent = this._elementRef.nativeElement;

    const scrollableSize = this.direction === 'horizontal' ? parent.clientWidth : parent.clientHeight;
    const currentScroll = this.direction === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;

    scrollElement.scrollTo({
      [this.direction === 'horizontal' ? 'left' : 'top']:
        currentScroll + (direction === 'start' ? -scrollableSize : scrollableSize),
      behavior: 'smooth',
    });
  }
}
