import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ethlete-dsp',
  template: `<h1>dsp</h1>

    <button class="dsp-button" type="button">A button</button> <br />
    <br />
    <button class="dsp-button" type="button" disabled>A button</button> <br />
    <br />
    <button class="dsp-button secondary" type="button">A button</button> <br />
    <br />
    <button class="dsp-button secondary" type="button" disabled>A button</button> <br />
    <br />
    <button class="dsp-button tertiary" type="button">A button</button> <br />
    <br />
    <button class="dsp-button tertiary" type="button" disabled>A button</button> <br />
    <br /> `,
  styleUrls: ['./dsp.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class DspComponent {}
