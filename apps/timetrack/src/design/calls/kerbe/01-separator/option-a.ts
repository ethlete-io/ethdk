import { Component, ViewEncapsulation } from '@angular/core';
import { KerbeBandComponent } from '../../../kerbe-band.component';
import { KerbeFrameComponent } from '../../../kerbe-frame';
import { BANDS, LANE_REM } from './fixture';

@Component({
  selector: 'ethlete-design-separator-a',
  template: `
    <ethlete-design-kerbe-frame [widthRem]="LANE_REM">
      @for (band of BANDS; track band.id) {
        <ethlete-design-kerbe-band [band]="band" separator="edge" treatment="inlay" />
      }
    </ethlete-design-kerbe-frame>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KerbeBandComponent, KerbeFrameComponent],
})
export default class SeparatorOptionAComponent {
  protected readonly BANDS = BANDS;
  protected readonly LANE_REM = LANE_REM;
}
