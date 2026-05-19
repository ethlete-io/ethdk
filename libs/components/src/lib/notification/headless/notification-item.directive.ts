import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { NotificationRef } from '../notification-ref';
import { NotificationStackDirective } from './notification-stack.directive';

@Directive({
  selector: '[etNotificationItem]',
  host: {
    '[attr.data-notification-id]': 'ref().id',
  },
})
export class NotificationItemDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private stack = inject(NotificationStackDirective, { optional: true });
  public ref = input.required<NotificationRef>({ alias: 'etNotificationItem' });

  constructor() {
    const el = this.elementRef.nativeElement;

    effect(() => {
      const id = this.ref().id;
      this.stack?.registerItem(id, el);

      return () => this.stack?.unregisterItem(id);
    });
  }
}
