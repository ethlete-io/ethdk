import { AnimationEvent } from '@angular/animations';
import { Direction, Directionality } from '@angular/cdk/bidi';
import { TemplatePortal } from '@angular/cdk/portal';
import { CdkScrollableModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
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
import { Subject, Subscription, distinctUntilChanged, startWith } from 'rxjs';
import { tabAnimations } from '../../../animations';
import { InlineTabBodyHostDirective } from '../inline-tab-body-host';

export type InlineTabBodyPositionState = 'left' | 'center' | 'right' | 'left-origin-center' | 'right-origin-center';

export type InlineTabBodyOriginState = 'left' | 'right';

@Component({
  selector: 'et-inline-tab-body',
  templateUrl: 'inline-tab-body.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  animations: [tabAnimations.translateTab],
  standalone: true,
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
  private _centeringSub = Subscription.EMPTY;
  private _leavingSub = Subscription.EMPTY;
  private _dirChangeSubscription = Subscription.EMPTY;

  _position!: InlineTabBodyPositionState;

  readonly _translateTabComplete = new Subject<AnimationEvent>();

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
  animationDuration = '500ms';

  @Input()
  preserveContent = false;

  @Input()
  set position(position: number) {
    this._positionIndex = position;
    this._computePositionAnimationState();
  }

  constructor() {
    if (this._dir) {
      this._dirChangeSubscription = this._dir.change.subscribe((dir: Direction) => {
        this._computePositionAnimationState(dir);
        this._cdr.markForCheck();
      });
    }

    this._translateTabComplete
      .pipe(
        distinctUntilChanged((x, y) => {
          return x.fromState === y.fromState && x.toState === y.toState;
        }),
      )
      .subscribe((event) => {
        if (this._isCenterPosition(event.toState) && this._isCenterPosition(this._position)) {
          this._onCentered.emit();
        }

        if (this._isCenterPosition(event.fromState) && !this._isCenterPosition(this._position)) {
          this._afterLeavingCenter.emit();
        }
      });
  }

  ngOnInit() {
    if (this._position == 'center' && this.origin != null) {
      this._position = this._computePositionFromOrigin(this.origin);
    }

    this._centeringSub = this._beforeCentering
      .pipe(startWith(this._isCenterPosition(this._position)))
      .subscribe((isCentering: boolean) => {
        if (isCentering && !this._portalHost.hasAttached()) {
          this._portalHost.attach(this._content);
        }
      });

    this._leavingSub = this._afterLeavingCenter.subscribe(() => {
      if (!this.preserveContent) {
        this._portalHost.detach();
      }
    });
  }

  ngOnDestroy() {
    this._dirChangeSubscription.unsubscribe();
    this._translateTabComplete.complete();
    this._centeringSub.unsubscribe();
    this._leavingSub.unsubscribe();
  }

  _onTranslateTabStarted(event: AnimationEvent): void {
    const isCentering = this._isCenterPosition(event.toState);
    this._beforeCentering.emit(isCentering);
    if (isCentering) {
      this._onCentering.emit(this._elementRef.nativeElement.clientHeight);
    }
  }

  _getLayoutDirection(): Direction {
    return this._dir && this._dir.value === 'rtl' ? 'rtl' : 'ltr';
  }

  _isCenterPosition(position: InlineTabBodyPositionState | string): boolean {
    return position == 'center' || position == 'left-origin-center' || position == 'right-origin-center';
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
