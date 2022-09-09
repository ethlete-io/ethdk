import { Component } from '@angular/core';
import { DialogRef } from '@ethlete/components';

@Component({
  selector: 'ethlete-dialog-example',
  template: `<h1>Example dialog</h1>`,
  standalone: true,
  styles: [
    `
      :host {
        display: block;
        background: white;
        padding: 16px;
        border-radius: 4px;
        color: black;
      }
    `,
  ],
})
export class DialogExampleComponent {
  constructor(private _dialogRef: DialogRef<DialogExampleComponent>) {}
}
