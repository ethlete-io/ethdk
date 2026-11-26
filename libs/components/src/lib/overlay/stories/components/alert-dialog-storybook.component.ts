import { Component, TemplateRef, ViewEncapsulation, input, signal, viewChild } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { BUTTON_IMPORTS } from '../../../button';
import { createAlertDialogOpener } from '../../alert-dialog/alert-dialog-opener';

@Component({
  selector: 'et-sb-alert-dialog-user',
  template: `
    <div class="flex flex-col gap-1 rounded-lg border border-white/15 p-3 text-medium" data-testid="alert-dialog-user">
      <span class="font-semibold">{{ name() }}</span>
      <span class="opacity-70">{{ email() }}</span>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class AlertDialogStorybookUserComponent {
  public name = input.required<string>();
  public email = input.required<string>();
}

type UserContext = { $implicit: string; email: string };

@Component({
  selector: 'et-sb-alert-dialog',
  template: `
    <div class="flex flex-col items-start gap-4 font-sans">
      <div class="flex flex-wrap gap-2">
        <button (click)="deleteProject()" et-button>Delete project</button>
        <button (click)="publish()" et-button variant="outline">Publish</button>
        <button (click)="showAlert()" et-button variant="outline">Show alert</button>
        <button (click)="removeEditor()" et-button variant="outline">Remove editor (component slot)</button>
        <button (click)="inviteEditor()" et-button variant="outline">Invite editor (template slot)</button>
      </div>

      <ng-template #userTemplate let-name let-email="email">
        <div class="flex flex-col gap-1 rounded-lg border border-white/15 p-3 text-medium">
          <span class="font-semibold">{{ name }}</span>
          <span class="opacity-70">{{ email }}</span>
        </div>
      </ng-template>

      <p class="text-medium" data-testid="alert-dialog-result">Result: {{ result() }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class AlertDialogStorybookComponent {
  private userTemplate = viewChild.required<TemplateRef<UserContext>>('userTemplate');

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

  protected removeEditor() {
    this.show(
      this.dialogs.confirm({
        title: 'Remove editor?',
        message: 'This person loses access to the competition.',
        confirmLabel: 'Remove editor',
        destructive: true,
        slot: {
          component: AlertDialogStorybookUserComponent,
          inputs: { name: () => 'Ada Lovelace', email: () => 'ada@example.com' },
        },
      }),
    );
  }

  protected inviteEditor() {
    this.show(
      this.dialogs.confirm({
        title: 'Invite editor?',
        message: 'An invitation is sent to this address.',
        confirmLabel: 'Send invitation',
        slot: { template: this.userTemplate(), context: { $implicit: 'Grace Hopper', email: 'grace@example.com' } },
      }),
    );
  }

  private show(result$: Observable<boolean | void>) {
    result$.pipe(tap((value) => this.result.set(value === undefined ? 'acknowledged' : String(value)))).subscribe();
  }
}
