import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { htmlToMarkdown } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { RICH_TEXT_EDITOR_TOKEN_CODEC } from '../rich-text-editor-token-codec.token';
import { HeadingTag, injectRichTextEditorDom, provideRichTextEditorDom } from './internals/rich-text-editor-dom';
import { RichTextEditorTokenCodec } from './internals/rich-text-editor-token';

@Directive({
  selector: '[etRichTextEditor]',
  providers: [provideRichTextEditorDom()],
})
export class RichTextEditorDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);

  /** @internal */
  public editorDom = injectRichTextEditorDom();

  public value = model('');
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  /**
   * @internal Codec that (de)serializes `{{type:id}}` token chips. Installed by
   * `[etRichTextEditorTriggers]` or a render-only provider; `null` when the building-block
   * feature isn't used, in which case token markdown is treated as plain text.
   */
  public tokenCodec = signal<RichTextEditorTokenCodec | null>(inject(RICH_TEXT_EDITOR_TOKEN_CODEC, { optional: true }));

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

  public headingLevel = signal<number | null>(null);

  /** @internal */
  public lastEmittedMarkdown: string | null = null;

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

    const markdown = htmlToMarkdown(this.serializeCleanHtml(root));

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
    this.headingLevel.set(states?.heading ?? null);
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

  public toggleHeading(level: number) {
    this.runCommand(() => this.editorDom.toggleHeading(`h${level}` as HeadingTag));
  }

  public setLink(href: string) {
    const url = href.trim();

    this.runCommand(() => (url ? this.editorDom.applyLink(url) : this.editorDom.removeLink()));
  }

  public promptForLink() {
    if (this.disabled() || this.readonly()) return;

    if (this.linkActive()) {
      this.setLink('');

      return;
    }

    const url = this.document.defaultView?.prompt('Link URL');

    if (url === null || url === undefined) return;

    this.setLink(url);
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

  private serializeCleanHtml(root: HTMLElement) {
    const clone = root.cloneNode(true) as HTMLElement;

    // Turn atomic token chips back into their `{{type:id}}` markdown form before the standard
    // HTML→markdown pass strips unknown tags (chips would otherwise be flattened to their label).
    this.tokenCodec()?.serialize(clone);

    let removed = true;

    while (removed) {
      removed = false;

      // eslint-disable-next-line ethlete/no-dom-query
      clone.querySelectorAll('strong, em, del, a').forEach((el) => {
        if ((el.textContent ?? '').length === 0) {
          el.remove();
          removed = true;
        }
      });
    }

    return clone.innerHTML.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>');
  }

  private runCommand(command: () => void) {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return;

    command();
    this.syncFromDom();
  }
}
