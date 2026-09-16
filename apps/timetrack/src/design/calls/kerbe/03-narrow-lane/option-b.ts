import { Component } from '@angular/core';
import { KerbeBandComponent } from '../../../kerbe-band.component';
import { KerbeFrameComponent } from '../../../kerbe-frame';
import { BANDS, LANE_REM } from './fixture';

@Component({
  selector: 'ethlete-design-narrow-b',
  template: `
    <ethlete-design-kerbe-frame [widthRem]="LANE_REM" [gapRem]="1.6">
      @for (band of BANDS; track band.id) {
        <ethlete-design-kerbe-band [band]="band" narrow="stack" treatment="inlay" />
      }
    </ethlete-design-kerbe-frame>
  `,
  imports: [KerbeBandComponent, KerbeFrameComponent],
})
export default class NarrowOptionBComponent {
  protected readonly BANDS = BANDS;
  protected readonly LANE_REM = LANE_REM;
}
