import {
  booleanAttribute,
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
  ElementRef,
  ViewEncapsulation,
} from '@angular/core';
import {
  AutoSurfaceDirective,
  COLOR_PROVIDER,
  ColorTheme,
  injectAnimatedBlockSize,
  injectErrorTheme,
  ProvideColorDirective,
} from '@ethlete/core';
import { ProgressBarComponent, SpinnerComponent } from '../../loader';
import { RichTextEditorTriggerItem } from './rich-text-editor-trigger';

/**
 * The caret-anchored autocomplete list opened by `[etRichTextEditorTriggers]`. Purely
 * presentational: it renders items / loading / error / empty states and reports selection and
 * hover. Focus stays in the editor's `contenteditable` — the active row is driven by
 * `aria-activedescendant`, and pointer events are `preventDefault`ed so mousedown never steals it.
 *
 * Mirrors `et-menu`: neutral surface chrome, an animated block-size resize as the list changes,
 * and an error line in the app's error color theme.
 */
@Component({
  selector: 'et-rich-text-editor-token-popup',
  templateUrl: './rich-text-editor-token-popup.component.html',
  styleUrl: './rich-text-editor-token-popup.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent, ProgressBarComponent, ProvideColorDirective],
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-rte-token-popup',
    role: 'listbox',
    '[id]': 'listboxId()',
    // keep the caret/selection in the editor when the user clicks a row
    '(mousedown)': '$event.preventDefault()',
  },
})
export class RichTextEditorTokenPopupComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  public items = input.required<RichTextEditorTriggerItem[]>();
  public activeIndex = input.required<number>();
  public loading = input(false, { transform: booleanAttribute });
  public error = input<string | null>(null);
  public emptyLabel = input('No results');
  public listboxId = input.required<string>();

  public selectItem = output<RichTextEditorTriggerItem>();
  public activateItem = output<number>();

  private bodyElement = viewChild<ElementRef<HTMLElement>>('body');

  /** The app's error color theme, or `null` when none is registered (error text stays neutral). */
  protected errorColorTheme: ColorTheme | null = this.resolveErrorTheme();

  constructor() {
    // The popup mounts in a detached overlay pane. Its surface IS the overlay's own surface, so it
    // paints the overlay's registered elevation exactly (via the surface-context tracker) rather
    // than stacking a level above it — the same treatment as the menu / tooltip panels.
    inject(AutoSurfaceDirective).matchOverlaySurface();

    // Color still has to be re-synced here instead of cascading through the detached DOM.
    effect(() => {
      const contextColorProvider = this.contextColorProvider;

      untracked(() => {
        if (contextColorProvider) {
          this.ownColorProvider.syncWithProvider(contextColorProvider);
        }
      });
    });

    // Smoothly animate the panel's height as the list changes (loading → results, filtering).
    injectAnimatedBlockSize({ observe: this.bodyElement, resizingClass: 'et-rte-token-popup--resizing' });
  }

  private resolveErrorTheme(): ColorTheme | null {
    try {
      return injectErrorTheme();
    } catch {
      return null;
    }
  }
}
