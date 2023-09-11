import { JsonPipe, NgFor } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { OVERLAY_DATA, OverlayCloseDirective, OverlayRef, OverlayTitleDirective } from '../../../overlay';
import { FILTER_OVERLAY_REF } from '../../constants';
import { FilterOverlayImports } from '../../filter-overlay.imports';

@Component({
  selector: 'et-sb-filter-overlay',
  template: `
    <div class="et-sb-filter-overlay">
      <h3 etOverlayTitle>Lorem header</h3>

      <et-filter-overlay-page-outlet />

      <button etOverlayClose type="button">Close me</button>
    </div>
  `,
  styles: [
    `
      .et-sb-filter-overlay {
        display: block;
        padding: 1rem;
      }

      .et-filter-overlay-page-outlet {
        margin-bottom: 20px;
      }
    `,
  ],
  standalone: true,
  imports: [OverlayTitleDirective, OverlayCloseDirective, JsonPipe, NgFor, FilterOverlayImports],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterOverlayStorybookComponent {
  private readonly _overlayRef = inject<OverlayRef<FilterOverlayStorybookComponent>>(OverlayRef);
  protected readonly data = inject(OVERLAY_DATA);
  protected readonly config = inject(FILTER_OVERLAY_REF);

  close() {
    this._overlayRef.close();
  }
}
