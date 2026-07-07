import { Direction, Directionality } from '@angular/cdk/bidi';
import { TemplatePortal } from '@angular/cdk/portal';
import { CdkScrollableModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { InlineTabBodyHostDirective } from '../inline-tab-body-host';

export type InlineTabBodyPositionState = 'left' | 'center' | 'right' | 'left-origin-center' | 'right-origin-center';

export type InlineTabBodyOriginState = 'left' | 'right';

@Component({
  selector: 'et-inline-tab-body',
  templateUrl: 'inline-tab-body.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [CdkScrollableModule, InlineTabBodyHostDirective],
  host: {
    class: 'et-inline-tab-body',
  },
})
export class InlineTabBodyComponent implements OnInit, OnDestroy {
  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _dir = inject(Directionality);
  private _cdr = inject(ChangeDetectorRef);

  private _positionIndex!: number;
  private _dirChangeSubscription = Subscription.EMPTY;

  private _initialized = false;
  private _wasCentered = false;

  _position!: InlineTabBodyPositionState;

  @Output()
  readonly _onCentering = new EventEmitter<number>();

  @Output()
  readonly _beforeCentering = new EventEmitter<boolean>();

  @Output()
  readonly _afterLeavingCenter = new EventEmitter<void>();

  @Output()
  readonly _onCentered = new EventEmitter<void>(true);

  @ViewChild(InlineTabBodyHostDirective, { static: true })
  _portalHost!: InlineTabBodyHostDirective;

  @Input('content')
  _content!: TemplatePortal;

  @Input()
  origin!: number | null;

  @Input()
  preserveContent = false;

  @Input()
  set position(position: number) {
    this._positionIndex = position;
    this._computePositionAnimationState();

    if (this._initialized) {
      this._syncPortal();
    }
  }

  constructor() {
    if (this._dir) {
      this._dirChangeSubscription = this._dir.change.subscribe((dir: Direction) => {
        this._computePositionAnimationState(dir);

        if (this._initialized) {
          this._syncPortal();
        }

        this._cdr.markForCheck();
      });
    }
  }

  ngOnInit() {
    if (this._position == 'center' && this.origin != null) {
      this._position = this._computePositionFromOrigin(this.origin);
    }

    this._initialized = true;
    this._syncPortal();
  }

  ngOnDestroy() {
    this._dirChangeSubscription.unsubscribe();
  }

  _getLayoutDirection(): Direction {
    return this._dir && this._dir.value === 'rtl' ? 'rtl' : 'ltr';
  }

  _isCenterPosition(position: InlineTabBodyPositionState | string): boolean {
    return position == 'center' || position == 'left-origin-center' || position == 'right-origin-center';
  }

  /**
   * Attaches the content portal when this body is centered and detaches it once it leaves the center
   * (unless `preserveContent` is set). This replaces the `@angular/animations` `translateTab` trigger,
   * whose only remaining role was driving the portal lifecycle — the slide itself never animated
   * (the animation duration was always `0ms`) and visibility is controlled by the parent group.
   */
  private _syncPortal() {
    const isCentered = this._isCenterPosition(this._position);

    if (isCentered) {
      this._beforeCentering.emit(true);

      if (!this._portalHost.hasAttached()) {
        this._portalHost.attach(this._content);
      }

      this._onCentering.emit(this._elementRef.nativeElement.clientHeight);
      this._onCentered.emit();
    } else if (this._wasCentered) {
      this._beforeCentering.emit(false);
      this._afterLeavingCenter.emit();

      if (!this.preserveContent) {
        this._portalHost.detach();
      }
    }

    this._wasCentered = isCentered;
  }

  private _computePositionAnimationState(dir: Direction = this._getLayoutDirection()) {
    if (this._positionIndex < 0) {
      this._position = dir == 'ltr' ? 'left' : 'right';
    } else if (this._positionIndex > 0) {
      this._position = dir == 'ltr' ? 'right' : 'left';
    } else {
      this._position = 'center';
    }
  }

  private _computePositionFromOrigin(origin: number): InlineTabBodyPositionState {
    const dir = this._getLayoutDirection();

    if ((dir == 'ltr' && origin <= 0) || (dir == 'rtl' && origin > 0)) {
      return 'left-origin-center';
    }

    return 'right-origin-center';
  }
}
