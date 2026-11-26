import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-button-surface-example',
  template: `
    @for (variant of VARIANTS; track variant) {
      <div>
        <p>{{ variant }}</p>
        @for (size of SIZES; track size) {
          <button [variant]="variant" [size]="size" et-button type="button">Save changes</button>
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class ButtonSurfaceExampleComponent {
  protected readonly VARIANTS = ['filled', 'outline', 'tonal', 'transparent'] as const;
  protected readonly SIZES = ['xl', 'lg', 'md', 'sm', 'xs'] as const;
}
