import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DIALOG_DATA } from '../../constants';
import { DialogCloseDirective } from '../../partials/dialog-close';
import { DialogTitleDirective } from '../../partials/dialog-title';
import { DialogRef } from '../../utils';

@Component({
  selector: 'et-sb-dialog',
  template: `
    <h3 etDialogTitle>Lorem header</h3>
    <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Vero, quia.</p>
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
      animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
      voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
      dolorem possimus laboriosam ipsum recusandae quos.
    </p>

    <h4>Data</h4>
    <pre>{{ (data | json) || 'Noting passed' }}</pre>

    <button (click)="close()" type="button">Close me</button>
    <button etDialogClose type="button">Or close me</button>
  `,
  styles: [
    `
      et-sb-dialog {
        display: block;
        padding: 1rem;
      }
    `,
  ],
  imports: [DialogTitleDirective, DialogCloseDirective, JsonPipe],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogStorybookComponent {
  private readonly _dialogRef = inject<DialogRef<DialogStorybookComponent>>(DialogRef);
  protected readonly data = inject(DIALOG_DATA);

  close() {
    this._dialogRef.close();
  }
}
