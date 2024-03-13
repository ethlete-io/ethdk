import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { OVERLAY_DATA } from '../../../../overlay/components/overlay/constants';
import { OverlayCloseDirective } from '../../../../overlay/components/overlay/partials/overlay-close';
import { OverlayTitleDirective } from '../../../../overlay/components/overlay/partials/overlay-title';
import { OverlayRef } from '../../../../overlay/components/overlay/utils/overlay-ref';
import { FILTER_OVERLAY_REF } from '../../constants';
import { FilterOverlayImports } from '../../filter-overlay.imports';

@Component({
  selector: 'et-sb-filter-overlay',
  template: `
    <form [formGroup]="filterOverlayRef.form" (ngSubmit)="filterOverlayRef.submit()" class="et-sb-filter-overlay">
      <h3 etOverlayTitle>Lorem header</h3>

      <et-filter-overlay-page-outlet />

      <button etOverlayClose type="button">Close me</button>

      <button etFilterOverlaySubmit>Submit</button>
      <button etFilterOverlayReset>Reset to default</button>
    </form>
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
  imports: [OverlayTitleDirective, OverlayCloseDirective, JsonPipe, FilterOverlayImports, ReactiveFormsModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterOverlayStorybookComponent {
  private readonly _overlayRef = inject<OverlayRef<FilterOverlayStorybookComponent>>(OverlayRef);
  protected readonly data = inject(OVERLAY_DATA);
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  close() {
    this._overlayRef.close();
  }
}
