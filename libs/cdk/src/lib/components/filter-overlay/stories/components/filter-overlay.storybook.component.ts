import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { OVERLAY_DATA, OverlayCloseDirective, OverlayRef, OverlayTitleDirective } from '../../../overlay';
import { FILTER_OVERLAY_CONFIG_TOKEN } from '../../services';

@Component({
  selector: 'et-sb-filter-overlay',
  template: `
    <div class="et-sb-filter-overlay">
      <h3 etOverlayTitle>Lorem header</h3>

      <input type="text" />
      <br /><br />

      <pre> {{ config | json }} </pre>

      <button etOverlayClose type="button">Or close me</button>
    </div>
  `,
  styles: [
    `
      .et-sb-filter-overlay {
        display: block;
        padding: 1rem;
      }
    `,
  ],
  standalone: true,
  imports: [OverlayTitleDirective, OverlayCloseDirective, JsonPipe],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterOverlayStorybookComponent {
  private readonly _overlayRef = inject<OverlayRef<FilterOverlayStorybookComponent>>(OverlayRef);
  protected readonly data = inject(OVERLAY_DATA);
  protected readonly config = inject(FILTER_OVERLAY_CONFIG_TOKEN);

  close() {
    this._overlayRef.close();
  }
}
