import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, ViewEncapsulation } from '@angular/core';
import { BOTTOM_SHEET_DATA } from '../../constants';
import { BottomSheetDragHandleComponent } from '../../partials';
import { BottomSheetRef } from '../../utils';

@Component({
  selector: 'et-sb-bottom-sheet',
  template: `
    <button etBottomSheetDragHandle type="button" aria-label="Close sheet"></button>
    <h3>Lorem header</h3>
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
  `,
  styles: [
    `
      et-sb-bottom-sheet {
        display: block;
        padding: 1rem;
      }
    `,
  ],
  standalone: true,
  imports: [BottomSheetDragHandleComponent, JsonPipe],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomSheetStorybookComponent {
  constructor(
    @Inject(BOTTOM_SHEET_DATA) public data: unknown,
    private _bottomSheetRef: BottomSheetRef<BottomSheetStorybookComponent>,
  ) {}

  close() {
    this._bottomSheetRef.close();
  }
}
