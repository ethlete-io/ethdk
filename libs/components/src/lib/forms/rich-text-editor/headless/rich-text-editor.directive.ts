import { DOCUMENT } from '@angular/common';
import { booleanAttribute, computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { htmlToMarkdown, injectRenderer, injectStyleManager, markdownToHtml, RuntimeError } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../rich-text-editor-errors';
import { injectRichTextEditorLabels, RichTextEditorLabels } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOKEN_CODEC } from '../rich-text-editor-token-codec.token';
import {
  RICH_TEXT_EDITOR_TOOL,
  RICH_TEXT_EDITOR_TOOL_BUTTONS,
  injectRichTextEditorTools,
  RichTextEditorTool,
  RichTextEditorToolDefinition,
} from '../rich-text-editor-tools';
import { RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import {
  HeadingTag,
  injectRichTextEditorDom,
  InlineTag,
  provideRichTextEditorDom,
  RichTextMarkStates,
} from './internals/rich-text-editor-dom';
import { createRichTextEditorHistory, RichTextEditorHistoryEntry } from './internals/rich-text-editor-history';
import {
  assertValidToken,
  buildChipElement,
  escapeHtmlText,
  RichTextEditorTokenChip,
  RichTextEditorTokenCodec,
} from './internals/rich-text-editor-token';
import { mountTextFieldShellStyles } from '../../form-field/form-field-text-shell-styles.component';
import { FormFieldRichTextStylesComponent } from '../../form-field/form-field-rich-text-styles.component';

/**
 * Calling a command whose DOM domain was never provided is a wiring mistake, so it throws - but only
 * in dev: every construction of this message sits inside an `ngDevMode` branch, which is what keeps
 * the strings out of a production bundle. Without them the command is a silent no-op.
 */
const missingDomFeature = (method: string, provider: string) =>
  new RuntimeError(
    RICH_TEXT_EDITOR_ERROR_CODES.DOM_FEATURE_NOT_PROVIDED,
    `${method} requires ${provider}(). Add it to a component or route's providers so this editor has the DOM operations it drives.`,
  );

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
  private injectedLabels = injectRichTextEditorLabels();

  /** Opt-in tools, for their content normalizers - see {@link RichTextEditorToolDefinition.normalize}. */
  private registeredTools = inject(RICH_TEXT_EDITOR_TOOL, { optional: true });

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
   *  convert into their marks. Registered token-trigger characters never autoformat. Switches off
   *  what `provideRichTextEditorAutoformat()` turned on; without that provider there is nothing to
   *  switch off. */
  public autoformat = input(true, { transform: booleanAttribute });

  /**
   * Per-instance overrides for the editor's strings, merged over the injected `RICH_TEXT_EDITOR_LABELS`.
   * Prefer `provideRichTextEditorLabels` for app-wide localization; use this for a one-off wording.
   */
  public labels = input<Partial<RichTextEditorLabels> | null>(null);

  /**
   * Snapshot undo/redo over the Markdown value. The native `contenteditable` stack is deliberately
   * never used - see {@link createRichTextEditorHistory}.
   */
  private history = createRichTextEditorHistory();

  /** Resolved toolbar tools: the `tools` input if set, otherwise the provided/default config. */
  public resolvedTools = computed(() => this.tools() ?? this.toolsConfig.tools);

  /**
   * @internal Every tool that can render, by token: the always-built-in buttons plus whatever was
   * registered through {@link RICH_TEXT_EDITOR_TOOL}. Both toolbars read this, so a token in
   * `resolvedTools()` with no entry here renders nothing - which is how an opt-in tool stays absent
   * until its provider is added.
   */
  public toolDefs = ((): ReadonlyMap<string, RichTextEditorToolDefinition> => {
    const defs = new Map<string, RichTextEditorToolDefinition>();

    for (const [token, button] of Object.entries(RICH_TEXT_EDITOR_TOOL_BUTTONS)) {
      if (button) defs.set(token, { token, ...button });
    }

    for (const def of this.registeredTools ?? []) defs.set(def.token, def);

    return defs;
  })();

  /**
   * The strings in effect here: the injected label set with this instance's `labels` applied. Every part
   * of the editor reads it through this - the toolbars, the link editor and the opt-in tools all reach
   * the editor already.
   */
  public resolvedLabels = computed<RichTextEditorLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /**
   * @internal Codec that (de)serializes `{{type:id}}` token chips. Installed by
   * `[etRichTextEditorTriggers]` or a render-only provider; `null` when the building-block
   * feature isn't used, in which case token markdown is treated as plain text.
   */
  public tokenCodec = signal<RichTextEditorTokenCodec | null>(inject(RICH_TEXT_EDITOR_TOKEN_CODEC, { optional: true }));

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().trim().length > 0);

  /** Whether {@link undo} would do anything: there is an edit left to take back, and the editor
   *  can currently be edited at all. */
  public canUndo = computed(() => this.canEdit() && this.history.canUndo());

  /** Whether {@link redo} would do anything - see {@link canUndo}. */
  public canRedo = computed(() => this.canEdit() && this.history.canRedo());

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
  public blockquoteActive = signal(false);

  /** Whether the caret sits in a fenced code block, where the value is literal text: no inline
   *  marks, no block structure and no autoformat apply there, so those tools disable themselves. */
  public codeBlockActive = signal(false);

  public headingLevel = signal<number | null>(null);

  /** Whether the selection sits inside a table cell. Block tools (heading menu, lists) disable
   *  themselves on it - a GFM table cell can only hold single-line inline content, so block
   *  markup inside one would not survive serialization. */
  public inTableCell = signal(false);

  /** The heading (block-style) tool is unavailable where a heading can't apply: inside table
   *  cells (no GFM form), inside list items (a heading would not survive list serialization), and
   *  inside a quote or code block (which serialize as lines of text). */
  public headingToolDisabled = computed(
    () =>
      this.inTableCell() ||
      this.unorderedListActive() ||
      this.orderedListActive() ||
      this.blockquoteActive() ||
      this.codeBlockActive(),
  );

  private inList = computed(() => this.unorderedListActive() || this.orderedListActive());

  /** Lists have no serialized form inside a table cell (inline content only) or inside a quote or
   *  code block (both serialize as lines of text). */
  public listToolDisabled = computed(() => this.inTableCell() || this.blockquoteActive() || this.codeBlockActive());

  /** The quote tool applies to plain blocks - and to an existing quote, to lift it back out. */
  public blockquoteToolDisabled = computed(() => this.inTableCell() || this.codeBlockActive() || this.inList());

  /** Same rule as the quote tool: a fence can neither hold another block nor live inside one. */
  public codeBlockToolDisabled = computed(() => this.inTableCell() || this.blockquoteActive() || this.inList());

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

  /** @internal `true` while a token-trigger popup run is active - suspends all autoformat. */
  public autoformatSuppressed = signal(false);

  /**
   * @internal Whether pasted text that spells a token out (`#User Name`) is turned back into a chip.
   * Set from `[etRichTextEditorTriggers]`'s `parsePastedTokens` input; on by default.
   */
  public parsePastedTokens = signal(true);

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
    injectStyleManager().mount(FormFieldRichTextStylesComponent);

    mountTextFieldShellStyles();

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    this.focus();
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) return;

    const el = this.editorDom.root();

    // Re-focusing a contenteditable that already holds the caret collapses the selection to its
    // start, so only focus when the editor isn't already focused (e.g. a click on the frame padding).
    if (!el || el.ownerDocument.activeElement === el) return;

    el.focus(options);
  }

  /**
   * Reads the DOM back into `value` and refreshes the toolbar state - the single point every edit
   * funnels through, which is also where the undo entry is recorded.
   *
   * @param opts.boundary Commit as its own history entry instead of extending the running typing
   *   burst. Every programmatic rewrite (paste, autoformat, a tool, a token insert) passes `true`,
   *   so a single undo takes the whole rewrite back.
   */
  public syncFromDom(opts?: { boundary?: boolean }) {
    const root = this.editorDom.root();

    if (!root) return;

    // A native edit can leave the wrapper of a code block or quote behind after its content was
    // deleted whole - only the browser produces those, so this only runs on the native input path.
    if (!opts?.boundary) {
      this.editorDom.codeBlock?.repairCodeBlock();
      this.editorDom.blockquote?.repairEmptyQuotes();
    }

    const markdown = htmlToMarkdown(this.serializeCleanHtml(root));

    // Value-neutral structure a tool needs back (image blocks are atoms, and cannot end the
    // document) - applied after reading, so it can never change what was read.
    this.normalizeContent(root);

    this.lastEmittedMarkdown = markdown;
    this.value.set(markdown);
    this.history.commit({ value: markdown, selection: this.editorDom.readSelectionOffsets() }, opts?.boundary);
    this.refreshActiveMarks();
  }

  /**
   * @internal Keeps the newest history entry's caret current while the content doesn't change, so
   * undoing an edit made after clicking elsewhere returns the caret to where the user actually was.
   * A selection outside the editor is ignored rather than recorded as "no caret".
   */
  public recordHistorySelection() {
    const offsets = this.editorDom.readSelectionOffsets();

    if (offsets) this.history.recordSelection(offsets);
  }

  /**
   * Restores the value from before the last edit. A burst of typing goes back a word at a time;
   * every programmatic rewrite (paste normalization, autoformat, a tool, a token insert) goes back
   * in one step.
   */
  public undo() {
    if (!this.canEdit()) return;

    this.applyHistoryEntry(this.history.undo());
  }

  /** Reapplies the last undone edit. */
  public redo() {
    if (!this.canEdit()) return;

    this.applyHistoryEntry(this.history.redo());
  }

  /**
   * @internal Renders a value the editor did not produce itself - a programmatic `value` write, a
   * form reset, the multi-language switcher moving to another language - into the editable, and
   * restarts the history from it: an outside write is a new document, so undo must not reach back
   * into the previous one's states.
   */
  public renderExternalValue(markdown = this.value()) {
    if (!this.writeValueToDom(markdown)) return;

    this.history.reset(markdown);
  }

  public refreshActiveMarks() {
    // While a stored-mark toggle is pending, keep the toolbar showing that pending state rather than
    // the caret's actual marks (the pending set is cleared on navigation or once consumed by typing).
    const pending = this.pendingMarks();

    if (pending !== null) {
      const states = this.editorDom.markStates();

      this.reflectMarks(pending);
      this.reflectBlockStates(states);

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
    this.reflectBlockStates(states);
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
    const autoformat = this.editorDom.autoformat;

    if (
      !autoformat ||
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
        ? autoformat.applyBlockAutoformat(isReserved)
        : data.length === 1 && '*_~`'.includes(data)
          ? autoformat.applyInlineAutoformat(data, isReserved)
          : false;

    if (handled) this.syncFromDom({ boundary: true });

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

  /** Quotes the selected blocks as `> ` lines, or lifts the caret's quote out one nesting level.
   *  Needs `provideRichTextEditorBlockquoteTool()`. */
  public toggleBlockquote() {
    const { blockquote } = this.editorDom;

    if (!blockquote) {
      if (ngDevMode) throw missingDomFeature('toggleBlockquote', 'provideRichTextEditorBlockquoteTool');

      return;
    }

    this.runCommand(() => blockquote.toggleBlockquote());
  }

  /** Turns the selected blocks into a fenced code block, or a code block back into paragraphs. Only
   *  the text survives either way - a fence is literal, so it carries no inline markup. Needs
   *  `provideRichTextEditorCodeBlockTool()`. */
  public toggleCodeBlock() {
    const { codeBlock } = this.editorDom;

    if (!codeBlock) {
      if (ngDevMode) throw missingDomFeature('toggleCodeBlock', 'provideRichTextEditorCodeBlockTool');

      return;
    }

    this.runCommand(() => codeBlock.toggleCodeBlock());
  }

  /** Needs `provideRichTextEditorHeadingTool()`. */
  public toggleHeading(level: number) {
    const { headings } = this.editorDom;

    if (!headings) {
      if (ngDevMode) throw missingDomFeature('toggleHeading', 'provideRichTextEditorHeadingTool');

      return;
    }

    this.runCommand(() => headings.toggleHeading(`h${level}` as HeadingTag));
  }

  /** Needs `provideRichTextEditorHeadingTool()`. */
  public setHeading(level: number | null) {
    const current = this.headingLevel();

    if (level === current) return;

    // `toggleHeading` re-levels a heading to any other level, and turns a heading back into a
    // paragraph only when handed its own level - which is exactly the "make it normal" case.
    const tagLevel = level ?? current;

    if (tagLevel === null) return;

    this.toggleHeading(tagLevel);
  }

  /** Applies (or, with an empty `href`, removes) a link on the current selection. `newTab` sets
   *  `target="_blank"` + `rel="noopener noreferrer"`; `text` overrides the visible label. Needs
   *  `provideRichTextEditorLinkTool()`. */
  public applyLink(href: string, options: { newTab?: boolean; text?: string | null } = {}) {
    const { links } = this.editorDom;

    if (!links) {
      if (ngDevMode) throw missingDomFeature('applyLink', 'provideRichTextEditorLinkTool');

      return;
    }

    const url = href.trim();

    this.runCommand(() => (url ? links.applyLink(url, options) : links.removeLink()));
  }

  /** Needs `provideRichTextEditorLinkTool()`. */
  public removeLink() {
    const { links } = this.editorDom;

    if (!links) {
      if (ngDevMode) throw missingDomFeature('removeLink', 'provideRichTextEditorLinkTool');

      return;
    }

    this.runCommand(() => links.removeLink());
  }

  /** Needs `provideRichTextEditorLinkTool()`. */
  public promptForLink() {
    if (this.disabled() || this.readonly() || this.codeBlockActive()) return;

    if (!this.editorDom.links) {
      if (ngDevMode) throw missingDomFeature('promptForLink', 'provideRichTextEditorLinkTool');

      return;
    }

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
      this.syncFromDom({ boundary: true });
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

    const markdown = this.parseTokenText(htmlToMarkdown(body.innerHTML));

    if (!markdown) return false;

    const normalized = markdownToHtml(markdown);

    this.editorDom.insertNormalizedHtml(codec ? codec.render(normalized) : normalized);

    const root = this.editorDom.root();

    if (codec && root) codec.hydrate(root);

    this.syncFromDom({ boundary: true });

    return true;
  }

  /**
   * Inserts plain clipboard text, recognizing tokens written the way they read - `#User Name` - and
   * turning them back into chips. Everything else stays literal (Markdown in plain text is never
   * interpreted), and with nothing to recognize this returns `false` so the browser inserts the
   * text itself, exactly as before.
   */
  public pasteText(text: string) {
    const codec = this.tokenCodec();

    if (!codec || !this.canEdit()) return false;

    const parsed = this.parseTokenText(text);

    if (parsed === text) return false;

    this.clearPendingMarks();

    // escape first: only the recognized tokens become markup, the rest of the text stays text
    this.editorDom.insertNormalizedHtml(codec.render(escapeHtmlText(parsed).replace(/\n/g, '<br>')));

    const root = this.editorDom.root();

    if (root) codec.hydrate(root);

    this.syncFromDom({ boundary: true });

    return true;
  }

  public insertAtomicToken(node: Node) {
    if (this.disabled() || this.readonly() || !this.editorDom.root()) return;

    this.editorDom.insertToken(node);
    this.syncFromDom({ boundary: true });
  }

  /**
   * Inserts a `{{type:id}}` token chip at the caret - the same result as picking it from the `#`/`@`
   * trigger popup - resolving its label via the matching trigger's `resolveItem`. Lets a consumer
   * wire a click-to-insert palette (their own placeholder/merge-field buttons) in a single call,
   * reusing the editor's codec and label resolution instead of appending token markdown to the value.
   *
   * Inserts at the current caret, or - if the editor isn't focused - at the position it last held,
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
   * (e.g. the row a palette button represents) - the label is used as-is, skipping resolution. The
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

  /** Token text (`#User Name`) → `{{type:id}}`, unless the app turned the recognition off. */
  private parseTokenText(text: string) {
    if (!this.parsePastedTokens()) return text;

    return this.tokenCodec()?.parseTokenText(text) ?? text;
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
    // Trailing no-break space so the caret escapes the chip and the next word doesn't hug it - same
    // treatment as the trigger popup (a plain trailing space is CSS-collapsed and dropped by Chrome;
    // serialization normalizes the nbsp back to a plain space).
    this.editorDom.insertToken(this.renderer.createText(' '));

    if (hydrate) this.tokenCodec()?.hydrate(root);

    this.syncFromDom({ boundary: true });

    // Focus last so the caret placed after the nbsp stays live. Skip when already focused -
    // re-focusing a contenteditable that holds the caret collapses the selection to its start.
    if ((focus ?? true) && root.ownerDocument.activeElement !== root) root.focus();
  }

  /** Runs the provided tools' content normalizers over the editable. */
  private normalizeContent(root: HTMLElement) {
    for (const tool of this.registeredTools ?? []) tool.normalize?.(root);
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

    // inside a fenced code block every mark would be literal text - read it off the DOM rather
    // than the signal, so a keyboard shortcut fired before the next selectionchange is covered too
    if (this.editorDom.markStates()?.codeBlock) return;

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

  /** The block context the caret sits in - read the same way whether or not stored marks are
   *  pending, since a pending mark only ever changes the inline state. */
  private reflectBlockStates(states: RichTextMarkStates | null) {
    this.blockquoteActive.set(states?.blockquote ?? false);
    this.codeBlockActive.set(states?.codeBlock ?? false);
    this.headingLevel.set(states?.heading ?? null);
    this.inTableCell.set(states?.tableCell ?? false);
  }

  private reflectMarks(tags: InlineTag[]) {
    this.boldActive.set(tags.includes('strong'));
    this.italicActive.set(tags.includes('em'));
    this.strikeActive.set(tags.includes('del'));
    this.underlineActive.set(tags.includes('u'));
    this.codeActive.set(tags.includes('code'));
  }

  private runCommand(command: () => void) {
    if (!this.canEdit()) return;

    // restore the pre-tap selection when a toolbar interaction moved focus off the editor
    this.editorDom.restoreSelection();

    command();
    // a command is a programmatic rewrite: one undo step, never merged into a typing burst
    this.syncFromDom({ boundary: true });
  }

  private canEdit() {
    return !this.disabled() && !this.readonly() && !!this.editorDom.root();
  }

  /** Restores a snapshot: the value into the DOM, then the caret it was taken with. */
  private applyHistoryEntry(entry: RichTextEditorHistoryEntry | null) {
    if (!entry) return;

    this.clearPendingMarks();
    this.writeValueToDom(entry.value);
    this.value.set(entry.value);
    this.editorDom.restoreSelectionOffsets(entry.selection);
    this.refreshActiveMarks();
  }

  /** Writes Markdown into the editable, replacing its content. Returns `false` without a root. */
  private writeValueToDom(markdown: string) {
    const root = this.editorDom.root();

    if (!root) return false;

    const codec = this.tokenCodec();
    const html = markdownToHtml(markdown);

    root.innerHTML = codec ? codec.render(html) : html;
    codec?.hydrate(root);
    this.normalizeContent(root);
    // the DOM now matches this value, so the render effect skips it as "already emitted"
    this.lastEmittedMarkdown = markdown;

    return true;
  }
}
