import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { DialogCloseDirective, DialogRef, DialogTitleDirective } from '@ethlete/components';

@Component({
  selector: 'ethlete-dialog-example',
  template: `<h1 et-dialog-title>Example dialog</h1>
    <br />
    <button type="button" etDialogClose>Close</button> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      ethlete-dialog-example {
        display: block;
        background: #282828;
        padding: 16px;
        border-radius: 10px;
      }
    `,
  ],
  imports: [DialogCloseDirective, DialogTitleDirective],
})
export class DialogExampleComponent {
  constructor(private _dialogRef: DialogRef<DialogExampleComponent>) {}
}
