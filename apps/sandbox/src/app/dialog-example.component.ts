import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { DialogCloseDirective, DialogRef, DialogTitleDirective } from '@ethlete/components';

@Component({
  selector: 'ethlete-dialog-example',
  template: `
    <h3 et-dialog-title>Example dialog</h3>
    <p style="max-width: 65ch;">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed ipsa eveniet amet expedita odio rem eligendi
      corrupti? Repellat corrupti dicta enim, labore laudantium quo ipsam!
    </p>
    <button type="button" etDialogClose>Close</button>
  `,
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
