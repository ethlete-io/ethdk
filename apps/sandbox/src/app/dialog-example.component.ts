import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { DialogCloseDirective, DialogRef, DialogTitleDirective } from '@ethlete/components';

@Component({
  selector: 'ethlete-dialog-example',
  template: `<h3 et-dialog-title>Example dialog</h3>
    <br />
    <button type="button" etDialogClose>Close</button> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      ethlete-dialog-example {
        display: block;
        padding: 16px;
      }
    `,
  ],
  imports: [DialogCloseDirective, DialogTitleDirective],
})
export class DialogExampleComponent {
  constructor(private _dialogRef: DialogRef<DialogExampleComponent>) {}
}
