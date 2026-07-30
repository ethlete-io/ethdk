import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { AutoSurfaceDirective, COLOR_PROVIDER, ProvideColorDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { IconDirective, provideIcons, TIMES_ICON } from '../../icon';
import { FORM_FIELD_IMPORTS } from '../form-field';
import { INPUT_IMPORTS } from '../input';
import { RichTextEditorLabels } from './rich-text-editor-labels';

/**
 * The image popover of the opt-in image tool: the alt text of the image at the caret, plus the action
 * that takes the image back out. Opened by `provideRichTextEditorImageTool`, in the same kind of
 * overlay as the link editor (anchored card on desktop, top sheet on phones).
 */
@Component({
  selector: 'et-rich-text-editor-image-editor',
  templateUrl: './rich-text-editor-image-editor.component.html',
  styleUrl: './rich-text-editor-image-editor.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, ...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, IconDirective],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-rte-image-editor',
    role: 'dialog',
    '[attr.aria-label]': 'labels().imageEditor',
    '(keydown.escape)': 'dismiss.emit()',
  },
})
export class RichTextEditorImageEditorComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  /** The editor's strings, handed in by the tool — the popover renders detached. */
  public labels = input.required<RichTextEditorLabels>();

  /** The image's current alt text. */
  public alt = input('');

  /** The image's URL, shown as a thumbnail so it is clear which image is being edited. */
  public src = input('');

  public saveAlt = output<string>();
  public removeImage = output<void>();
  public dismiss = output<void>();

  protected altValue = linkedSignal(() => this.alt());

  protected fileName = computed(() => {
    const path = this.src().split(/[?#]/)[0] ?? '';

    return decodeURIComponent(path.split('/').pop() ?? '') || this.src();
  });

  constructor() {
    // Same detached-overlay treatment as the link editor: paint the overlay's own surface elevation,
    // and re-sync the color scope, which cannot cascade through the portal boundary.
    inject(AutoSurfaceDirective).matchOverlaySurface();

    effect(() => {
      const contextColorProvider = this.contextColorProvider;

      untracked(() => {
        if (contextColorProvider) this.ownColorProvider.syncWithProvider(contextColorProvider);
      });
    });
  }

  protected save() {
    this.saveAlt.emit(this.altValue().trim());
  }

  /** Enter applies. Prevented so the editor, focused right after, doesn't also see the keydown. */
  protected saveOnEnter(event: Event) {
    event.preventDefault();
    this.save();
  }
}
