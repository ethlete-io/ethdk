import { DOCUMENT } from '@angular/common';
import { booleanAttribute, computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { htmlToMarkdown, injectRenderer, markdownToHtml, RuntimeError } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../rich-text-editor-errors';
import { RICH_TEXT_EDITOR_TOKEN_CODEC } from '../rich-text-editor-token-codec.token';
import { injectRichTextEditorTools, RichTextEditorTool } from '../rich-text-editor-tools';
import { RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import {
  HeadingTag,
  injectRichTextEditorDom,
  InlineTag,
  provideRichTextEditorDom,
} from './internals/rich-text-editor-dom';
import {
  assertValidToken,
  buildChipElement,
  RichTextEditorTokenChip,
  RichTextEditorTokenCodec,
} from './internals/rich-text-editor-token';

@Directive({
  selector: '[etRichTextEditor]',
  exportAs: 'etRichTextEditor',
  providers: [provideRichTextEditorDom()],
})
export class RichTextEditorDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private toolsConfig = injectRichTextEditorTools();

  /** @internal */
  public editorDom = injectRichTextEditorDom();

  public value = model('');
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  // eslint-disable-next-line ethlete/no-native-html-input-name
  public hidden = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public placeholder = input('');

  /** Which formatting tools the toolbar renders, and in what order. Falls back to the value from
   *  `provideRichTextEditorTools` (or the full default set). */
  public tools = input<readonly RichTextEditorTool[] | null>(null);

  /** Markdown autoformat while typing: `- `, `1. ` and `# `–`### ` at a line start convert into
   *  lists/headings, and closing `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `__`/`_` runs
   *  convert into their marks. Registered token-trigger characters never autoformat. */
  public autoformat = input(true, { transform: booleanAttribute });

  /** Resolved toolbar tools: the `tools` input if set, otherwise the provided/default config. */
  public resolvedTools = computed(() => this.tools() ?? this.toolsConfig.tools);

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

  public boldActive = signal(false);
  public italicActive = signal(false);
  public strikeActive = signal(false);
  public underlineActive = signal(false);
  public codeActive = signal(false);
  public unorderedListActive = signal(false);
  public orderedListActive = signal(false);
  public linkActive = signal(false);

  public headingLevel = signal<number | null>(null);

  /** Whether the selection sits inside a table cell. Block tools (heading menu, lists) disable
   *  themselves on it — a GFM table cell can only hold single-line inline content, so block
   *  markup inside one would not survive serialization. */
  public inTableCell = signal(false);

  /** The heading (block-style) tool is unavailable where a heading can't apply: inside table
   *  cells (no GFM form) and inside list items (a heading would not survive list serialization). */
  public headingToolDisabled = computed(
    () => this.inTableCell() || this.unorderedListActive() || this.orderedListActive(),
  );

  /**
   * @internal Inline marks queued for the next typed text while the selection is collapsed ("stored
   * marks"). `null` means "follow the caret"; a list means the next input is wrapped in exactly these.
   */
  public pendingMarks = signal<InlineTag[] | null>(null);

  /**
   * @internal Characters claimed by the token-trigger system (set by `[etRichTextEditorTriggers]`).
   * Autoformat rules keyed on these characters never fire, so a `#` trigger keeps opening its
   * autocomplete instead of becoming a heading.
   */
  public autoformatReservedChars = signal<readonly string[]>([]);

  /** @internal `true` while a token-trigger popup run is active — suspends all autoformat. */
  public autoformatSuppressed = signal(false);

  /** @internal */
  public lastEmittedMarkdown: string | null = null;

  /**
   * @internal Opens the link editor popover, registered by `[etRichTextEditorLinkEditor]` (mounted by
   * the default `et-rich-text-editor`). `null` for a bare `[etRichTextEditor]` with no popover, where
   * {@link promptForLink} falls back to a native prompt.
   */
  public openLinkEditor = signal<(() => void) | null>(null);

  /** @internal Whether the link editor popover is currently open. Kept so the mobile docked toolbar
   *  stays visible through the link flow (focus is temporarily inside the popover) and so the link
   *  toolbar button shows its pressed state while the popover is open. */
  public linkEditorOpen = signal(false);

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
    // While a stored-mark toggle is pending, keep the toolbar showing that pending state rather than
    // the caret's actual marks (the pending set is cleared on navigation or once consumed by typing).
    const pending = this.pendingMarks();

    if (pending !== null) {
      const states = this.editorDom.markStates();

      this.reflectMarks(pending);
      this.headingLevel.set(states?.heading ?? null);
      this.inTableCell.set(states?.tableCell ?? false);

      return;
    }

    const states = this.editorDom.markStates();

    this.boldActive.set(states?.bold ?? false);
    this.italicActive.set(states?.italic ?? false);
    this.strikeActive.set(states?.strike ?? false);
    this.underlineActive.set(states?.underline ?? false);
    this.codeActive.set(states?.code ?? false);
    this.unorderedListActive.set(states?.unorderedList ?? false);
    this.orderedListActive.set(states?.orderedList ?? false);
    this.linkActive.set(states?.link ?? false);
    this.headingLevel.set(states?.heading ?? null);
    this.inTableCell.set(states?.tableCell ?? false);
  }

  public toggleBold() {
    this.toggleMark('strong');
  }

  public toggleItalic() {
    this.toggleMark('em');
  }

  public toggleStrikethrough() {
    this.toggleMark('del');
  }

  public toggleUnderline() {
    this.toggleMark('u');
  }

  public toggleInlineCode() {
    this.toggleMark('code');
  }

  /**
   * Runs markdown autoformat for a single typed character (called from `beforeinput`): a space may
   * convert a line-start prefix into a list/heading, a delimiter char may close an inline run into
   * its mark. Returns `true` when the character was consumed by a conversion.
   */
  public handleAutoformat(data: string) {
    if (
      !this.autoformat() ||
      this.autoformatSuppressed() ||
      this.disabled() ||
      this.readonly() ||
      !this.editorDom.root()
    ) {
      return false;
    }

    const reserved = new Set(this.autoformatReservedChars());
    const isReserved = (char: string) => reserved.has(char);

    const handled =
      data === ' '
        ? this.editorDom.applyBlockAutoformat(isReserved)
        : data.length === 1 && '*_~`'.includes(data)
          ? this.editorDom.applyInlineAutoformat(data, isReserved)
          : false;

    if (handled) this.syncFromDom();

    return handled;
  }

  public consumePendingInsert(text: string) {
    const pending = this.pendingMarks();

    if (pending === null) return false;

    this.pendingMarks.set(null);
    this.runCommand(() => this.editorDom.insertInlineText(text, pending));

    return true;
  }

  public clearPendingMarks() {
    if (this.pendingMarks() !== null) {
      this.pendingMarks.set(null);
      this.refreshActiveMarks();
    }
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

  public setHeading(level: number | null) {
    const current = this.headingLevel();

    if (level === current) return;

    // `toggleHeading` re-levels a heading to any other level, and turns a heading back into a
    // paragraph only when handed its own level — which is exactly the "make it normal" case.
    const tagLevel = level ?? current;

    if (tagLevel === null) return;

    this.runCommand(() => this.editorDom.toggleHeading(`h${tagLevel}` as HeadingTag));
  }

  /** Applies (or, with an empty `href`, removes) a link on the current selection. `newTab` sets
   *  `target="_blank"` + `rel="noopener noreferrer"`; `text` overrides the visible label. */
  public applyLink(href: string, options: { newTab?: boolean; text?: string | null } = {}) {
    const url = href.trim();

    this.runCommand(() => (url ? this.editorDom.applyLink(url, options) : this.editorDom.removeLink()));
  }

  public removeLink() {
    this.runCommand(() => this.editorDom.removeLink());
  }

  public promptForLink() {
    if (this.disabled() || this.readonly()) return;

    const open = this.openLinkEditor();

    if (open) {
      open();

      return;
    }

    // Fallback for a bare [etRichTextEditor] with no link-editor popover mounted.
    if (this.linkActive()) {
      this.removeLink();

      return;
    }

    const url = this.document.defaultView?.prompt('Link URL');

    if (url === null || url === undefined) return;

    this.applyLink(url);
  }

  public handleBackspace() {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return false;

    const handled = this.editorDom.handleBackspace();

    if (handled) {
      this.syncFromDom();
    }

    return handled;
  }

  public pasteHtml(html: string) {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return false;

    this.clearPendingMarks();

    // DOMParser yields an inert document: clipboard scripts never run and images never load
    // while the foreign markup is being reduced.
    const body = new DOMParser().parseFromString(html, 'text/html').body;

    // eslint-disable-next-line ethlete/no-dom-query -- clipboard HTML (e.g. from Word) embeds <style> blocks whose CSS text would survive the tag-strip as plain text
    body.querySelectorAll('style, script, noscript, meta, link, title').forEach((junk) => junk.remove());

    const codec = this.tokenCodec();

    codec?.serialize(body);

    const markdown = htmlToMarkdown(body.innerHTML);

    if (!markdown) return false;

    const normalized = markdownToHtml(markdown);

    this.editorDom.insertNormalizedHtml(codec ? codec.render(normalized) : normalized);

    const root = this.editorDom.root();

    if (codec && root) codec.hydrate(root);

    this.syncFromDom();

    return true;
  }

  public insertAtomicToken(node: Node) {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return;

    this.editorDom.insertToken(node);
    this.syncFromDom();
  }

  /**
   * Inserts a `{{type:id}}` token chip at the caret — the same result as picking it from the `#`/`@`
   * trigger popup — resolving its label via the matching trigger's `resolveItem`. Lets a consumer
   * wire a click-to-insert palette (their own placeholder/merge-field buttons) in a single call,
   * reusing the editor's codec and label resolution instead of appending token markdown to the value.
   *
   * Inserts at the current caret, or — if the editor isn't focused — at the position it last held,
   * falling back to the end of the content. The caret is left after the chip. A token codec must be
   * installed (by `[etRichTextEditorTriggers]` or `provideRichTextEditorTokenRendering`); without one
   * token markdown can't round-trip, so this throws in dev and no-ops in production.
   *
   * @param opts.focus Focus the editor after inserting so the user can keep typing. @default true
   */
  // eslint-disable-next-line max-params -- (type, id, opts?) is the documented public API shape, mirroring common editor insert methods
  public insertToken(type: string, id: string, opts?: { focus?: boolean }) {
    const codec = this.requireTokenCodec();

    if (!codec) return;
    if (ngDevMode) assertValidToken(type, id);

    // resolveChip resolves the label synchronously (id fallback); hydrate patches async resolvers.
    this.insertChip(codec.resolveChip(type, id), { focus: opts?.focus, hydrate: true });
  }

  /**
   * Like {@link insertToken}, but for when the app already holds the resolved `{ id, label }` item
   * (e.g. the row a palette button represents) — the label is used as-is, skipping resolution. The
   * trigger-char prefix still comes from the installed codec, so the chip matches the popup's.
   *
   * @param opts.focus Focus the editor after inserting so the user can keep typing. @default true
   */
  // eslint-disable-next-line max-params -- (type, item, opts?) mirrors insertToken's documented public API shape
  public insertTokenItem(type: string, item: RichTextEditorTriggerItem, opts?: { focus?: boolean }) {
    const codec = this.requireTokenCodec();

    if (!codec || item.disabled) return;
    if (ngDevMode) assertValidToken(type, item.id);

    // Keep the codec's trigger-char prefix, but honor the caller's already-resolved label (no hydrate).
    this.insertChip({ ...codec.resolveChip(type, item.id), label: item.label }, { focus: opts?.focus, hydrate: false });
  }

  private requireTokenCodec(): RichTextEditorTokenCodec | null {
    const codec = this.tokenCodec();

    if (!codec && ngDevMode) {
      throw new RuntimeError(
        RICH_TEXT_EDITOR_ERROR_CODES.INSERT_TOKEN_WITHOUT_CODEC,
        'insertToken requires a token codec. Add [etRichTextEditorTriggers] or provideRichTextEditorTokenRendering() so {{type:id}} tokens can (de)serialize.',
      );
    }

    return codec;
  }

  private insertChip(chip: RichTextEditorTokenChip, { focus, hydrate }: { focus?: boolean; hydrate: boolean }) {
    if (this.disabled() || this.readonly()) return;

    const root = this.editorDom.root();

    if (!root || !this.editorDom.ensureCaret()) return;

    this.editorDom.insertToken(buildChipElement(this.renderer, chip));
    // Trailing no-break space so the caret escapes the chip and the next word doesn't hug it — same
    // treatment as the trigger popup (a plain trailing space is CSS-collapsed and dropped by Chrome;
    // serialization normalizes the nbsp back to a plain space).
    this.editorDom.insertToken(this.renderer.createText(' '));

    if (hydrate) this.tokenCodec()?.hydrate(root);

    this.syncFromDom();

    // Focus last so the caret placed after the nbsp stays live. Skip when already focused —
    // re-focusing a contenteditable that holds the caret collapses the selection to its start.
    if ((focus ?? true) && root.ownerDocument.activeElement !== root) root.focus();
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

    return (
      clone.innerHTML
        .replace(/<div>/gi, '<p>')
        .replace(/<\/div>/gi, '</p>')
        // drop zero-width spaces used transiently to park the caret outside an inline mark (code exit)
        .replace(/\u200b/g, '')
    );
  }

  private toggleMark(tag: InlineTag) {
    if (this.disabled() || this.readonly()) return;

    // a tap on the (docked) toolbar can move focus off the editor on touch; restore the selection
    this.editorDom.restoreSelection();

    const selection = this.editorDom.getSelection();

    if (selection && !selection.range.collapsed) {
      this.pendingMarks.set(null);
      this.runCommand(() => this.editorDom.toggleInline(tag));

      return;
    }

    const base = this.pendingMarks() ?? this.editorDom.activeInlineTags();
    const next = base.includes(tag) ? base.filter((mark) => mark !== tag) : [...base, tag];

    this.pendingMarks.set(next);
    this.reflectMarks(next);
  }

  private reflectMarks(tags: InlineTag[]) {
    this.boldActive.set(tags.includes('strong'));
    this.italicActive.set(tags.includes('em'));
    this.strikeActive.set(tags.includes('del'));
    this.underlineActive.set(tags.includes('u'));
    this.codeActive.set(tags.includes('code'));
  }

  private runCommand(command: () => void) {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return;

    // restore the pre-tap selection when a toolbar interaction moved focus off the editor
    this.editorDom.restoreSelection();

    command();
    this.syncFromDom();
  }
}
