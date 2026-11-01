import { Component, input, model, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { SurfaceInteractiveDirective } from '@ethlete/core';

export const DISCLOSURE_BODY_CLASS =
  'flex flex-col gap-space-1 m-0 text-et-surface-muted text-(length:--text-xs) *:flex *:gap-space-2';

@Component({
  selector: 'ethlete-disclosure',
  templateUrl: './disclosure.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, SurfaceInteractiveDirective],
  host: { class: 'block font-ui text-ui-md' },
})
export class DisclosureComponent {
  public label = input.required<string>();
  public body = input<string | null>(null);
  public open = model(false);
  public size = input<'sm' | 'xs'>('sm');
}
