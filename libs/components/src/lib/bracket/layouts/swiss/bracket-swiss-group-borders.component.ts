import { Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { BracketRect } from '@ethlete/bracket';
import { injectSwissToneThemes } from './swiss-tone-themes';

/**
 * The swiss group borders in their record tones. Only `swissBracketLayout()` may reference it, or every
 * bracket bundles the tone theming.
 *
 * @internal
 */
@Component({
  selector: 'svg[et-bracket-swiss-group-borders]',
  template: `
    @for (rect of rects(); track rect.id) {
      @let toneTheme = rect.tone ? toneThemes()[rect.tone] : null;

      <svg:g [etProvideColor]="toneTheme" [attr.data-swiss-toned]="toneTheme ? '' : null">
        <svg:rect
          [attr.x]="rect.x"
          [attr.y]="rect.y"
          [attr.width]="rect.width"
          [attr.height]="rect.height"
          [attr.rx]="rect.radius"
          [attr.stroke]="rect.stroke"
          [attr.stroke-width]="rect.strokeWidth"
          [attr.class]="rect.cssClass"
          fill="none"
        />
      </svg:g>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: {
    overflow: 'visible',
  },
})
export class BracketSwissGroupBordersComponent {
  protected toneThemes = injectSwissToneThemes();

  public rects = input.required<BracketRect[]>();
}
