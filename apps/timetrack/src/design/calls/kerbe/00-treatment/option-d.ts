import { Component, ViewEncapsulation } from '@angular/core';
import { KerbeBandComponent } from '../../../kerbe-band.component';
import { KerbeFrameComponent } from '../../../kerbe-frame';
import { BANDS, LANE_REM } from './fixture';

@Component({
  selector: 'ethlete-design-treatment-d',
  template: `
    <ethlete-design-kerbe-frame [widthRem]="LANE_REM">
      @for (band of BANDS; track band.id) {
        <ethlete-design-kerbe-band [band]="band" treatment="rule" />
      }
    </ethlete-design-kerbe-frame>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KerbeBandComponent, KerbeFrameComponent],
})
export default class TreatmentOptionDComponent {
  protected readonly BANDS = BANDS;
  protected readonly LANE_REM = LANE_REM;
}
