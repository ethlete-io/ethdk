import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, injectNotificationManager, provideNotificationManager } from '@ethlete/components';

@Component({
  selector: 'app-notification-rtl-example',
  template: `
    <div>
      <button (click)="open()" et-button size="sm">Open a notification</button>
      <button (click)="rtl.set(!rtl())" et-button size="sm" variant="outline">
        Direction: {{ rtl() ? 'rtl' : 'ltr' }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  providers: [provideNotificationManager({ position: 'bottom-end' })],
})
export class NotificationRtlExampleComponent {
  private manager = injectNotificationManager();

  protected rtl = signal(true);

  constructor() {
    const document = inject(DOCUMENT);
    const root = document.documentElement;
    const initialDir = root.dir;

    effect(() => (root.dir = this.rtl() ? 'rtl' : initialDir));
    inject(DestroyRef).onDestroy(() => (root.dir = initialDir));
  }

  protected open() {
    this.manager.open({ status: 'info', title: 'Bottom end', message: 'Docks to the inline-end edge.' });
  }
}
