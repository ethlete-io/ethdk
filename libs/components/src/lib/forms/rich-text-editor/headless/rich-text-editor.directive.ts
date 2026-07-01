import { computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { htmlToMarkdown } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { injectRichTextEditorDom, provideRichTextEditorDom } from './internals/rich-text-editor-dom';

@Directive({
  selector: '[etRichTextEditor]',
  providers: [provideRichTextEditorDom()],
})
export class RichTextEditorDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model('');
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().trim().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.RICH_TEXT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);
  public describedById = computed(() => this.describedBy());

  public boldActive = signal(false);
  public italicActive = signal(false);
  public strikeActive = signal(false);
  public unorderedListActive = signal(false);
  public orderedListActive = signal(false);
  public linkActive = signal(false);

  /** @internal */
  public lastEmittedMarkdown: string | null = null;

  /** @internal */
  public editorDom = injectRichTextEditorDom();

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    if (this.disabled()) return;

    const el = this.editorDom.root();

    // Re-focusing a contenteditable that already holds the caret collapses the selection to its
    // start, so only focus when the editor isn't already focused (e.g. a click on the frame padding).
    if (!el || el.ownerDocument.activeElement === el) return;

    el.focus();
  }

  public syncFromDom() {
    const root = this.editorDom.root();

    if (!root) return;

    // Browsers create <div> line wrappers in contenteditable; map them to <p> so htmlToMarkdown
    // treats them as paragraph breaks instead of stripping the tags and merging lines.
    const html = root.innerHTML.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>');
    const markdown = htmlToMarkdown(html);

    this.lastEmittedMarkdown = markdown;
    this.value.set(markdown);
    this.refreshActiveMarks();
  }

  public refreshActiveMarks() {
    const states = this.editorDom.markStates();

    this.boldActive.set(states?.bold ?? false);
    this.italicActive.set(states?.italic ?? false);
    this.strikeActive.set(states?.strike ?? false);
    this.unorderedListActive.set(states?.unorderedList ?? false);
    this.orderedListActive.set(states?.orderedList ?? false);
    this.linkActive.set(states?.link ?? false);
  }

  public toggleBold() {
    this.runCommand(() => this.editorDom.toggleInline('strong'));
  }

  public toggleItalic() {
    this.runCommand(() => this.editorDom.toggleInline('em'));
  }

  public toggleStrikethrough() {
    this.runCommand(() => this.editorDom.toggleInline('del'));
  }

  public toggleUnorderedList() {
    this.runCommand(() => this.editorDom.toggleList('ul'));
  }

  public toggleOrderedList() {
    this.runCommand(() => this.editorDom.toggleList('ol'));
  }

  public setLink(href: string) {
    const url = href.trim();

    this.runCommand(() => (url ? this.editorDom.applyLink(url) : this.editorDom.removeLink()));
  }

  public handleBackspace() {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return false;

    const handled = this.editorDom.handleBackspace();

    if (handled) {
      this.syncFromDom();
    }

    return handled;
  }

  /**
   * @internal Extension seam for the follow-up `@`/`#` autocomplete: inserts an atomic inline
   * node (a mention/placeholder token) at the caret, then re-syncs.
   */
  public insertAtomicToken(node: Node) {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return;

    this.editorDom.insertToken(node);
    this.syncFromDom();
  }

  private runCommand(command: () => void) {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return;

    command();
    this.syncFromDom();
  }
}
