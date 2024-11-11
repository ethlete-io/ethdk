import {
  AfterContentInit,
  booleanAttribute,
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  numberAttribute,
  OnDestroy,
  Output,
} from '@angular/core';
import { debounceTime, Subscription } from 'rxjs';
import { ResizeObserverService } from '../../services';

@Directive({
  selector: '[etObserveResize]',
  exportAs: 'etObserveResize',
  standalone: true,
})
export class ObserveResizeDirective implements AfterContentInit, OnDestroy {
  private _resizeObserver = inject(ResizeObserverService);
  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _ngZone = inject(NgZone);

  @Output('etObserveResize')
  readonly valueChange = new EventEmitter<ResizeObserverEntry[]>();

  @Input('etObserveResizeDisabled')
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: unknown) {
    this._disabled = booleanAttribute(value);

    if (this._disabled) {
      this._unsubscribe();
    } else {
      this._subscribe();
    }
  }
  private _disabled = false;

  @Input('etObserveResizeDebounce')
  get debounce(): number | null {
    return this._debounce;
  }
  set debounce(value: unknown) {
    this._debounce = numberAttribute(value) ?? null;
    this._subscribe();
  }
  private _debounce: number | null = null;

  private _currentSubscription: Subscription | null = null;

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
    const stream = this._resizeObserver.observe(this._elementRef);

    this._ngZone.runOutsideAngular(() => {
      this._currentSubscription = (this.debounce ? stream.pipe(debounceTime(this.debounce)) : stream).subscribe(
        this.valueChange,
      );
    });
  }

  private _unsubscribe() {
    this._currentSubscription?.unsubscribe();
  }
}
