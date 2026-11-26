import { Component, ViewEncapsulation, input } from '@angular/core';
import { BUTTON_IMPORTS, injectNotificationManager } from '@ethlete/components';

@Component({
  selector: 'app-achievement-medal',
  template: `<span aria-hidden="true">🏅</span> <strong>{{ medal() }}</strong>`,
  encapsulation: ViewEncapsulation.None,
})
class AchievementMedalComponent {
  public medal = input.required<string>();
}

@Component({
  selector: 'app-notification-content-example',
  template: `<button (click)="unlock()" et-button type="button">Unlock achievement</button>`,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class NotificationContentExampleComponent {
  private manager = injectNotificationManager();

  protected unlock() {
    this.manager.open({
      status: 'success',
      title: 'Achievement unlocked',
      message: 'You watched your first ten films.',
      content: { component: AchievementMedalComponent, inputs: { medal: 'Film explorer' } },
    });
  }
}
