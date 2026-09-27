import { Component, ViewEncapsulation } from '@angular/core';
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
import { TOOLBAR_IMPORTS } from '../toolbar.imports';

@Component({
  selector: 'et-sb-toolbar-nested',
  template: `
    <div class="p-8 font-sans">
      <et-toolbar aria-label="Editor" etAutoSurface>
        <button
          et-icon-button
          color="surface"
          pressedColor="inherit"
          size="sm"
          type="button"
          aria-label="Bulleted list"
        >
          <i etIcon="et-list-bulleted"></i>
        </button>
        <button
          et-icon-button
          color="surface"
          pressedColor="inherit"
          size="sm"
          type="button"
          aria-label="Numbered list"
        >
          <i etIcon="et-list-numbered"></i>
        </button>
        <et-divider orientation="vertical" decorative />
        <et-toolbar aria-label="Text formatting">
          <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Bold">
            <i etIcon="et-bold"></i>
          </button>
          <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Italic">
            <i etIcon="et-italic"></i>
          </button>
          <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Underline">
            <i etIcon="et-underline"></i>
          </button>
        </et-toolbar>
        <et-divider orientation="vertical" decorative />
        <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Quote">
          <i etIcon="et-quote"></i>
        </button>
        <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Link">
          <i etIcon="et-link"></i>
        </button>
      </et-toolbar>

      <p class="text-small mt-4">
        The inner toolbar is a tab stop of its own: the outer arrow keys skip it, and Tab moves between the two.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TOOLBAR_IMPORTS, BUTTON_IMPORTS, DIVIDER_IMPORTS, ICON_IMPORTS, AutoSurfaceDirective],
  providers: [
    provideIcons(BOLD_ICON, ITALIC_ICON, UNDERLINE_ICON, LIST_BULLETED_ICON, LIST_NUMBERED_ICON, QUOTE_ICON, LINK_ICON),
  ],
  styles: `
    et-sb-toolbar-nested > div > .et-toolbar {
      --et-toolbar-background: var(--et-surface-background-solid);

      inline-size: fit-content;
      border: 1px solid var(--et-surface-border-solid);
    }
  `,
})
export class ToolbarNestedStorybookComponent {}
