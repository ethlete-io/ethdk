import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { OverlayImports, provideOverlay } from '../../../overlay';
import { FilterOverlayService } from '../../services';
import { FilterOverlayStorybookComponent } from './filter-overlay.storybook.component';

@Component({
  selector: 'et-sb-filter-overlay-host',
  template: ` <button (click)="transformingBottomSheetToDialog()" type="button">Open filter</button> `,
  standalone: true,
  imports: [OverlayImports, NgIf],
  providers: [provideOverlay(), FilterOverlayService],
})
export class FilterOverlayHostStorybookComponent {
  private readonly _overlayService = inject(FilterOverlayService);

  transformingBottomSheetToDialog() {
    this._overlayService.open(
      FilterOverlayStorybookComponent,
      {
        defaultFormValue: {},
        form: new FormGroup({}),
        id: 'filter',
        pages: [],
        initialRoute: '',
      },
      {
        positions: this._overlayService.positions.transformingBottomSheetToDialog({}),
      },
    );
  }
}
