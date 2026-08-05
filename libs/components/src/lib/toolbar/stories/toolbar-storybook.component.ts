import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { DIVIDER_IMPORTS } from '../../divider';
import {
  BOLD_ICON,
  ICON_IMPORTS,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  provideIcons,
  QUOTE_ICON,
  UNDERLINE_ICON,
} from '../../icon';
import { ToolbarOrientation } from '../headless/toolbar.types';
import { TOOLBAR_IMPORTS } from '../toolbar.imports';

@Component({
  selector: 'et-sb-toolbar',
  template: `
    <div class="p-8 font-sans">
      <et-toolbar [orientation]="orientation()" aria-label="Text formatting" etAutoSurface>
        <button et-icon-button mutedUntilPressed size="sm" type="button" aria-label="Bold">
          <i etIcon="et-bold"></i>
        </button>
        <button
          [disabled]="disableItalic()"
          et-icon-button
          mutedUntilPressed
          size="sm"
          type="button"
          aria-label="Italic"
        >
          <i etIcon="et-italic"></i>
        </button>
        <button et-icon-button mutedUntilPressed size="sm" type="button" aria-label="Underline">
          <i etIcon="et-underline"></i>
        </button>
        <et-divider [orientation]="dividerOrientation()" decorative />
        <button et-icon-button mutedUntilPressed size="sm" type="button" aria-label="Bulleted list">
          <i etIcon="et-list-bulleted"></i>
        </button>
        <button et-icon-button mutedUntilPressed size="sm" type="button" aria-label="Numbered list">
          <i etIcon="et-list-numbered"></i>
        </button>
        <et-divider [orientation]="dividerOrientation()" decorative />
        <button et-icon-button mutedUntilPressed size="sm" type="button" aria-label="Quote">
          <i etIcon="et-quote"></i>
        </button>
        <button et-icon-button mutedUntilPressed size="sm" type="button" aria-label="Link">
          <i etIcon="et-link"></i>
        </button>
      </et-toolbar>

      <p class="text-small mt-4">Tab into the toolbar, then use the arrow keys, Home and End.</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TOOLBAR_IMPORTS, BUTTON_IMPORTS, DIVIDER_IMPORTS, ICON_IMPORTS, AutoSurfaceDirective],
  providers: [
    provideIcons(BOLD_ICON, ITALIC_ICON, UNDERLINE_ICON, LIST_BULLETED_ICON, LIST_NUMBERED_ICON, QUOTE_ICON, LINK_ICON),
  ],
  styles: `
    et-sb-toolbar .et-toolbar {
      --et-toolbar-background: var(--et-surface-background-solid);

      inline-size: fit-content;
      border: 1px solid var(--et-surface-border-solid);
    }
  `,
})
export class ToolbarStorybookComponent {
  public orientation = input<ToolbarOrientation>('horizontal');

  public disableItalic = input(false);

  protected dividerOrientation = computed(() => (this.orientation() === 'horizontal' ? 'vertical' : 'horizontal'));
}
