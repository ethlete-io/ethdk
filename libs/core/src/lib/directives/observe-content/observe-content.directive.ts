import { coerceBooleanProperty, coerceNumberProperty, BooleanInput, NumberInput } from '@angular/cdk/coercion';
import { AfterContentInit, Directive, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ContentObserverService } from '../../services';

@Directive({
  selector: '[etObserveContent]',
  exportAs: 'etObserveContent',
})
export class ObserveContentDirective implements AfterContentInit, OnDestroy {
  @Output('etObserveContent') readonly event = new EventEmitter<MutationRecord[]>();

  @Input('etObserveContentDisabled')
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
    this._disabled ? this._unsubscribe() : this._subscribe();
  }
  private _disabled = false;

  @Input('etObserveContentDebounce')
  get debounce(): number | null {
    return this._debounce;
  }
  set debounce(value: NumberInput) {
    this._debounce = coerceNumberProperty(value);
    this._subscribe();
  }
  private _debounce: number | null = null;

  private _currentSubscription: Subscription | null = null;

  constructor(
    private _contentObserver: ContentObserverService,
    private _elementRef: ElementRef<HTMLElement>,
    private _ngZone: NgZone,
  ) {}

  ngAfterContentInit() {
    if (!this._currentSubscription && !this.disabled) {
      this._subscribe();
    }
  }

  ngOnDestroy() {
    this._unsubscribe();
  }

  private _subscribe() {
    this._unsubscribe();
    const stream = this._contentObserver.observe(this._elementRef);

    this._ngZone.runOutsideAngular(() => {
      this._currentSubscription = (this.debounce ? stream.pipe(debounceTime(this.debounce)) : stream).subscribe(
        this.event,
      );
    });
  }

  private _unsubscribe() {
    this._currentSubscription?.unsubscribe();
  }
}
