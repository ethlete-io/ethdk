import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import {
  BOLD_ICON,
  BUTTON_IMPORTS,
  DIVIDER_IMPORTS,
  ICON_IMPORTS,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  QUOTE_ICON,
  TOOLBAR_IMPORTS,
  UNDERLINE_ICON,
  provideIcons,
} from '@ethlete/components';

@Component({
  selector: 'app-toolbar-default-example',
  template: `
    <et-toolbar class="example-toolbar" orientation="horizontal" aria-label="Text formatting" etAutoSurface>
      <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Bold">
        <i etIcon="et-bold"></i>
      </button>
      <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Italic">
        <i etIcon="et-italic"></i>
      </button>
      <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Underline">
        <i etIcon="et-underline"></i>
      </button>
      <et-divider orientation="vertical" decorative />
      <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Bulleted list">
        <i etIcon="et-list-bulleted"></i>
      </button>
      <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Numbered list">
        <i etIcon="et-list-numbered"></i>
      </button>
      <et-divider orientation="vertical" decorative />
      <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Quote">
        <i etIcon="et-quote"></i>
      </button>
      <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Link">
        <i etIcon="et-link"></i>
      </button>
    </et-toolbar>

    <p>Tab into the toolbar, then use the arrow keys, Home and End.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TOOLBAR_IMPORTS, BUTTON_IMPORTS, DIVIDER_IMPORTS, ICON_IMPORTS, AutoSurfaceDirective],
  providers: [
    provideIcons(BOLD_ICON, ITALIC_ICON, UNDERLINE_ICON, LIST_BULLETED_ICON, LIST_NUMBERED_ICON, QUOTE_ICON, LINK_ICON),
  ],
  styles: `
    .example-toolbar {
      --et-toolbar-background: var(--et-surface-background-solid);

      inline-size: fit-content;
      border: 1px solid var(--et-surface-border-solid);
    }
  `,
})
export class ToolbarDefaultExampleComponent {}
