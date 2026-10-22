import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, injectNotificationManager, provideNotificationManager } from '@ethlete/components';
import { firstValueFrom, map, mergeMap, of, timer } from 'rxjs';

@Component({
  selector: 'app-notification-promise-example',
  template: `
    <div>
      <button (click)="fromPromise(true)" et-button size="sm" variant="outline">Promise resolves</button>
      <button (click)="fromPromise(false)" et-button size="sm" variant="outline">Promise rejects</button>
      <button (click)="fromObservable()" et-button size="sm" variant="outline">Observable</button>
      <button (click)="manager.dismissAll()" et-button size="sm" variant="transparent">Dismiss all</button>
    </div>

    <p>Every button opens one notification that turns into its own result.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  providers: [provideNotificationManager({ position: 'bottom-end' })],
})
export class NotificationPromiseExampleComponent {
  protected manager = injectNotificationManager();

  protected fromPromise(succeeds: boolean) {
    const work = firstValueFrom(
      timer(1500).pipe(
        map(() => {
          if (!succeeds) throw new Error('Disk full');

          return { name: 'report-q4.pdf' };
        }),
      ),
    );

    this.manager.promise(work, {
      loading: 'Saving…',
      success: (saved) => ({ title: 'Saved', message: `${saved.name} is safe.` }),
      error: (error) => ({ title: 'Could not save', message: (error as Error).message }),
    });
  }

  protected fromObservable() {
    this.manager.promise(timer(1500).pipe(mergeMap(() => of(3))), {
      loading: { title: 'Counting files…', message: 'Walking the directory.' },
      success: (count) => `Found ${count} files`,
      error: 'Could not count the files',
    });
  }
}
