import { Component, ViewEncapsulation } from '@angular/core';
import { KerbeBandComponent } from '../../../kerbe-band.component';
import { KerbeFrameComponent } from '../../../kerbe-frame';
import { BANDS, LANE_REM } from './fixture';

@Component({
  selector: 'ethlete-design-separator-c',
  template: `
    <ethlete-design-kerbe-frame [widthRem]="LANE_REM">
      @for (band of BANDS; track band.id; let i = $index) {
        <ethlete-design-kerbe-band [band]="band" [alt]="i % 2 === 1" separator="alternate" treatment="inlay" />
      }
    </ethlete-design-kerbe-frame>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KerbeBandComponent, KerbeFrameComponent],
})
export default class SeparatorOptionCComponent {
  protected readonly BANDS = BANDS;
  protected readonly LANE_REM = LANE_REM;
}
