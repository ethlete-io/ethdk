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
import { COLOR_PROVIDER, ProvideColorDirective, ProvideSurfaceDirective, SURFACE_PROVIDER } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { IconDirective, provideIcons, TIMES_ICON } from '../../icon';
import { CHECKBOX_IMPORTS } from '../checkbox';
import { CHOICE_FIELD_IMPORTS } from '../choice-field';
import { FORM_FIELD_IMPORTS } from '../form-field';
import { INPUT_IMPORTS } from '../input';

/** The payload the link editor emits on apply. */
export type RichTextEditorLinkEditorValue = {
  href: string;
  text: string;
  newTab: boolean;
};

@Component({
  selector: 'et-rich-text-editor-link-editor',
  templateUrl: './rich-text-editor-link-editor.component.html',
  styleUrl: './rich-text-editor-link-editor.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...BUTTON_IMPORTS,
    ...FORM_FIELD_IMPORTS,
    ...INPUT_IMPORTS,
    ...CHOICE_FIELD_IMPORTS,
    ...CHECKBOX_IMPORTS,
    IconDirective,
  ],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [ProvideColorDirective, ProvideSurfaceDirective],
  host: {
    class: 'et-rte-link-editor',
    role: 'dialog',
    'aria-label': 'Edit link',
    '(keydown.escape)': 'dismiss.emit()',
  },
})
export class RichTextEditorLinkEditorComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private contextSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });

  public href = input('');
  public text = input('');
  public newTab = input(false);
  /** Whether the caret sits on an existing link (shows the Remove action + "Update"/"Add" wording). */
  public exists = input(false);

  public saveLink = output<RichTextEditorLinkEditorValue>();
  public removeLink = output<void>();
  public dismiss = output<void>();

  protected urlValue = linkedSignal(() => this.href());
  protected textValue = linkedSignal(() => this.text());
  protected newTabValue = linkedSignal(() => this.newTab());

  protected title = computed(() => (this.exists() ? 'Edit link' : 'Add link'));

  constructor() {
    // The popover mounts in a detached overlay pane, so color/surface context is re-synced here
    // instead of cascading through the DOM (same as the token popup / menu). Initial focus of the
    // URL field is handled by the overlay's `autoFocus` (reliable timing; works within the tap's
    // user-activation window so the mobile keyboard opens).
    effect(() => {
      const contextColorProvider = this.contextColorProvider;
      const contextSurfaceProvider = this.contextSurfaceProvider;

      untracked(() => {
        if (contextColorProvider) this.ownColorProvider.syncWithProvider(contextColorProvider);
        if (contextSurfaceProvider) this.ownSurfaceProvider.syncWithProvider(contextSurfaceProvider);
      });
    });
  }

  protected save() {
    const href = this.urlValue().trim();

    if (!href) return;

    this.saveLink.emit({ href, text: this.textValue().trim(), newTab: this.newTabValue() });
  }

  /** Applying re-focuses the editor before the browser processes the Enter keydown's default
   *  action, which would then insert a line break into the editor — so the default is prevented. */
  protected saveOnEnter(event: Event) {
    event.preventDefault();
    this.save();
  }
}
