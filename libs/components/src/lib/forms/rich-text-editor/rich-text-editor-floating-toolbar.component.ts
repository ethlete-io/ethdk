import { Component, effect, inject, input, untracked, ViewEncapsulation } from '@angular/core';
import { COLOR_PROVIDER, ProvideColorDirective, ProvideSurfaceDirective, SURFACE_PROVIDER } from '@ethlete/core';
import { IconButtonComponent } from '../../button/icon-button.component';
import { BOLD_ICON, IconDirective, ITALIC_ICON, LINK_ICON, provideIcons, STRIKETHROUGH_ICON } from '../../icon';
import { RichTextEditorDirective } from './headless/rich-text-editor.directive';

@Component({
  selector: 'et-rich-text-editor-floating-toolbar',
  templateUrl: './rich-text-editor-floating-toolbar.component.html',
  styleUrl: './rich-text-editor-floating-toolbar.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconButtonComponent, IconDirective],
  providers: [provideIcons(BOLD_ICON, ITALIC_ICON, STRIKETHROUGH_ICON, LINK_ICON)],
  hostDirectives: [ProvideColorDirective, ProvideSurfaceDirective],
  host: {
    class: 'et-rte-floating-toolbar',
    role: 'toolbar',
    'aria-label': 'Selection formatting',
    // keep the caret/selection in the editor when the user clicks a button
    '(mousedown)': '$event.preventDefault()',
  },
})
export class RichTextEditorFloatingToolbarComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private contextSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });

  /** The editor whose selection this toolbar formats (passed in — the toolbar is detached from the DOM). */
  public editor = input.required<RichTextEditorDirective>();

  constructor() {
    // Detached overlay pane: re-sync color and surface context instead of cascading through the DOM,
    // adopting the pane's elevation (see the token popup for the same treatment).
    effect(() => {
      const contextColorProvider = this.contextColorProvider;
      const contextSurfaceProvider = this.contextSurfaceProvider;

      untracked(() => {
        if (contextColorProvider) {
          this.ownColorProvider.syncWithProvider(contextColorProvider);
        }

        if (contextSurfaceProvider) {
          this.ownSurfaceProvider.syncWithProvider(contextSurfaceProvider);
        }
      });
    });
  }
}
