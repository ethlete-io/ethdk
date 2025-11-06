import {
  AfterContentInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  booleanAttribute,
  inject,
  numberAttribute,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ContentObserverService } from '../../services';

@Directive({
  selector: '[etObserveContent]',
  exportAs: 'etObserveContent',
  standalone: true,
})
export class ObserveContentDirective implements AfterContentInit, OnDestroy {
  private _contentObserver = inject(ContentObserverService);
  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _ngZone = inject(NgZone);

  @Output('etObserveContent')
  readonly valueChange = new EventEmitter<MutationRecord[]>();

  @Input('etObserveContentDisabled')
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

  @Input('etObserveContentDebounce')
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
    const stream = this._contentObserver.observe(this._elementRef);

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
