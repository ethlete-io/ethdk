import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { SlideToggleDirective } from '../../public-api';

@Component({
  selector: 'et-slide-toggle',
  templateUrl: './slide-toggle.component.html',
  styleUrls: ['./slide-toggle.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-slide-toggle',
  },
  imports: [NgClass],
  hostDirectives: [{ directive: SlideToggleDirective, inputs: ['checked', 'disabled'] }],
})
export class SlideToggleComponent {
  protected slideToggle = inject(SlideToggleDirective);
}
