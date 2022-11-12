import { Directive, ElementRef, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { ClickObserverService } from '../../services';

@Directive({
  selector: '[etClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective implements OnInit, OnDestroy {
  private _elementRef = inject(ElementRef);
  private _clickObserverService = inject(ClickObserverService);

  private _subscription: Subscription | null = null;

  @Output()
  etClickOutside = new EventEmitter<MouseEvent>();

  ngOnInit(): void {
    setTimeout(() => {
      this._subscription = this._clickObserverService.observe(this._elementRef.nativeElement).subscribe((event) => {
        const activeElement = event.target as HTMLElement;
        const isInside = this._elementRef.nativeElement.contains(activeElement);

        if (!isInside) {
          this.etClickOutside.emit(event);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this._subscription?.unsubscribe();
  }
}
