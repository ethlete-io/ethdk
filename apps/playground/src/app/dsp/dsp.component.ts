import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ethlete-dsp',
  template: `<h1>dsp</h1>

    <button class="dsp-button" type="button">A button</button> <br />
    <br />
    <button class="dsp-button" type="button" disabled>A button</button> <br />
    <br /> `,
  styleUrls: ['./dsp.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [],
  hostDirectives: [],
})
export class DspComponent {}
