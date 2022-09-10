import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { BottomSheetDragHandleComponent, DialogRef, DialogTitleDirective } from '@ethlete/components';

@Component({
  selector: 'ethlete-bottom-sheet-example',
  template: `
    <button et-bottom-sheet-drag-handle aria-label="Close sheet" type="button"></button>
    <h3 et-dialog-title>Example bottom sheet</h3>

    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed ipsa eveniet amet expedita odio rem eligendi
      corrupti? Repellat corrupti dicta enim, labore laudantium quo ipsam!
    </p>

    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed ipsa eveniet amet expedita odio rem eligendi
      corrupti? Repellat corrupti dicta enim, labore laudantium quo ipsam!
    </p>

    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed ipsa eveniet amet expedita odio rem eligendi
      corrupti? Repellat corrupti dicta enim, labore laudantium quo ipsam!
    </p>

    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed ipsa eveniet amet expedita odio rem eligendi
      corrupti? Repellat corrupti dicta enim, labore laudantium quo ipsam!
    </p>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      ethlete-bottom-sheet-example {
        display: block;
        padding: 16px;
      }
    `,
  ],
  imports: [DialogTitleDirective, BottomSheetDragHandleComponent],
})
export class BottomSheetExampleComponent {
  constructor(private _dialogRef: DialogRef<BottomSheetExampleComponent>) {}
}
