import { Component, ViewEncapsulation } from '@angular/core';
import { KerbeBandComponent } from '../../../kerbe-band.component';
import { KerbeFrameComponent } from '../../../kerbe-frame';
import { BANDS, LANE_REM } from './fixture';

@Component({
  selector: 'ethlete-design-short-a',
  template: `
    <ethlete-design-kerbe-frame [widthRem]="LANE_REM" [gapRem]="1.6">
      @for (band of BANDS; track band.id) {
        <ethlete-design-kerbe-band [band]="band" shrink="small" treatment="inlay" />
      }
    </ethlete-design-kerbe-frame>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KerbeBandComponent, KerbeFrameComponent],
})
export default class ShortOptionAComponent {
  protected readonly BANDS = BANDS;
  protected readonly LANE_REM = LANE_REM;
}
