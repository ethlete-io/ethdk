import { Component, ViewEncapsulation, input } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { injectNotificationManager } from '../../notification-manager';

@Component({
  selector: 'et-sb-notification-medal',
  template: `<span aria-hidden="true">🏅</span> <strong>{{ medal() }}</strong>`,
  encapsulation: ViewEncapsulation.None,
})
class NotificationMedalStorybookComponent {
  public medal = input.required<string>();
}

@Component({
  selector: 'et-sb-notification-content',
  template: ` <button (click)="open()" et-button type="button">Unlock achievement</button> `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class NotificationContentStorybookComponent {
  private manager = injectNotificationManager();

  protected open() {
    this.manager.open({
      status: 'success',
      title: 'Achievement unlocked',
      message: 'You watched your first ten films.',
      content: { component: NotificationMedalStorybookComponent, inputs: { medal: 'Film explorer' } },
      duration: 0,
    });
  }
}
