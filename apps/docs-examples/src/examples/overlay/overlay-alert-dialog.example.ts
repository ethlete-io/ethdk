import { Component, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, createAlertDialogOpener } from '@ethlete/components';
import { Observable, tap } from 'rxjs';

@Component({
  selector: 'app-overlay-alert-dialog-example',
  template: `
    <div>
      <button (click)="deleteProject()" et-button>Delete project</button>
      <button (click)="publish()" et-button variant="outline">Publish</button>
      <button (click)="showAlert()" et-button variant="outline">Show alert</button>
    </div>

    <p>Result: {{ result() }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class OverlayAlertDialogExampleComponent {
  private dialogs = createAlertDialogOpener();

  protected result = signal('none');

  protected deleteProject() {
    this.show(
      this.dialogs.confirm({
        title: 'Delete project?',
        message: 'The project and its 12 boards are deleted for everyone.\nThis cannot be undone.',
        confirmLabel: 'Delete project',
        destructive: true,
      }),
    );
  }

  protected publish() {
    this.show(this.dialogs.confirm({ title: 'Publish the draft?', message: 'Subscribers are notified right away.' }));
  }

  protected showAlert() {
    this.show(this.dialogs.alert({ title: 'Export finished', message: 'The file is in your downloads.' }));
  }

  private show(result$: Observable<boolean | void>) {
    result$.pipe(tap((value) => this.result.set(value === undefined ? 'acknowledged' : String(value)))).subscribe();
  }
}
