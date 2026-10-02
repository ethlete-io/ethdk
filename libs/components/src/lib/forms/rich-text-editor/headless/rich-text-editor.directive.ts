import { DOCUMENT } from '@angular/common';
import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import {
  htmlToMarkdown,
  injectRenderer,
  injectStyleManager,
  isSafeLinkUrl,
  MARKDOWN_VERBATIM_ATTR,
  markdownToHtml,
  mountEasingTokens,
  RuntimeError,
} from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import {
  AccessibleNameControlDirective,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
} from '../../form-field/headless';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../rich-text-editor-errors';
import { injectRichTextEditorLabels, RichTextEditorLabels } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOKEN_CODEC } from '../rich-text-editor-token-codec.token';
import {
  DEFAULT_RICH_TEXT_EDITOR_TOOLS,
  RICH_TEXT_EDITOR_TOOL_BUTTONS,
  RICH_TEXT_EDITOR_TOOLS,
  injectRichTextEditorTools,
  RichTextEditorTool,
  RichTextEditorToolDefinition,
} from '../rich-text-editor-tools';
import { RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import {
  injectRichTextEditorDom,
  InlineTag,
  provideRichTextEditorDom,
  RichTextMarkStates,
} from './internals/rich-text-editor-dom';
import { EditorRenderer, RichTextEditorHeadingLevel } from './internals/rich-text-editor-dom-core';
import { injectRegisteredRichTextEditorTools } from './internals/rich-text-editor-registered-tools';
import { clipboardPlainText } from './internals/rich-text-editor-dom-paste';
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

export type { RichTextEditorHeadingLevel };

const EMPTY_INLINE_SWEEP_SELECTOR = 'strong, em, del, u, code, a';

const INERT_STYLE_ATTRIBUTE = 'data-et-paste-style';

const INLINE_RUN_BOUNDARY = /^(?:P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|FIGURE|HR)$/;

const hasContent = (node: Node) =>
  (node.textContent ?? '').trim().length > 0 || (node instanceof Element && node.tagName !== 'BR');

// Chrome's native Enter after a first line typed into an empty editor leaves that line a bare text
// run and puts the next one in a `<div>`; unwrapped, the paragraph break serializes as a soft one.
const wrapLineBeforeNativeDiv = (root: HTMLElement, renderer: EditorRenderer) => {
  const nodes = [...root.childNodes];
  const boundary = nodes.findIndex((node) => node instanceof Element && INLINE_RUN_BOUNDARY.test(node.tagName));
  const run = nodes.slice(0, boundary);
  const [first] = run;

  if (!first || boundary < 1 || (nodes[boundary] as Element).tagName !== 'DIV' || !run.some(hasContent)) return;

  const paragraph = renderer.createElement('p') as HTMLElement;

  renderer.insertBefore(root, paragraph, first);
  for (const node of run) renderer.appendChild(paragraph, node);
};

const HTML_START_TAG = /<[a-z][^\s/>]*(?:\s+[^\s/>=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/gi;
const HTML_ATTRIBUTE = /(\s+)([^\s/>=]+)((?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)/g;

const renameStyleAttribute = (attribute: string, ...[space, name, value]: string[]) =>
  name?.toLowerCase() === 'style' ? `${space}${INERT_STYLE_ATTRIBUTE}${value}` : attribute;

const renameStyleAttributes = (html: string) =>
  html.replace(HTML_START_TAG, (tag) => tag.replace(HTML_ATTRIBUTE, renameStyleAttribute));

const restoreStyleAttributes = (html: string) => html.replaceAll(` ${INERT_STYLE_ATTRIBUTE}="`, ' style="');

const collectTextNodes = (root: HTMLElement) => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  return nodes;
};

/** Every call must sit inside an `ngDevMode` branch - that is what keeps these strings out of a production bundle. */
type InlineMarkStates = Pick<RichTextMarkStates, 'bold' | 'italic' | 'strike' | 'underline' | 'code'>;

const inlineMarkStates = (tags: InlineTag[]): InlineMarkStates => ({
  bold: tags.includes('strong'),
  italic: tags.includes('em'),
  strike: tags.includes('del'),
  underline: tags.includes('u'),
  code: tags.includes('code'),
});

const TOOL_PROVIDERS: Partial<Record<string, string>> = {
  heading: 'provideRichTextEditorHeadingTool()',
  blockquote: 'provideRichTextEditorBlockquoteTool()',
  codeBlock: 'provideRichTextEditorCodeBlockTool()',
  link: 'provideRichTextEditorLinkTool()',
  align: 'provideRichTextEditorAlignmentTool()',
  table: 'provideRichTextEditorTableTool()',
  image: 'provideRichTextEditorImageTool()',
};

const missingToolWarning = (tool: string) => {
  const provider = TOOL_PROVIDERS[tool];

  return provider
    ? `[etRichTextEditor] The '${tool}' tool is configured but not provided, so the toolbar leaves it out. Add ${provider} to a component or route's providers.`
    : `[etRichTextEditor] The '${tool}' tool is configured but no tool registers that token, so the toolbar leaves it out. Check the spelling, or register it with provideRichTextEditorTool().`;
};

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
export class RichTextEditorDirective
  extends AccessibleNameControlDirective
  implements FormValueControl<string>, FormFieldControl
{
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private toolsConfig = injectRichTextEditorTools();
  private injectedLabels = injectRichTextEditorLabels();

  private registeredTools = injectRegisteredRichTextEditorTools();

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

  public touch = output<void>();

  private history = createRichTextEditorHistory();

  /** @internal */
  public toolDefs = ((): ReadonlyMap<string, RichTextEditorToolDefinition> => {
    const defs = new Map<string, RichTextEditorToolDefinition>();

    for (const [token, button] of Object.entries(RICH_TEXT_EDITOR_TOOL_BUTTONS)) {
      if (button) defs.set(token, { token, ...button });
    }

    for (const def of this.registeredTools) defs.set(def.token, def);

    return defs;
  })();

  /**
   * Resolved toolbar tools: the `tools` input if set, otherwise the provided/default config, with
   * every token that has no definition dropped, and no doubled or dangling divider left behind.
   */
  public resolvedTools = computed(() => {
    const configured = this.tools() ?? this.toolsConfig.tools;
    const rendered: RichTextEditorTool[] = [];

    for (const tool of configured) {
      if (tool !== RICH_TEXT_EDITOR_TOOLS.DIVIDER) {
        if (this.toolDefs.has(tool)) rendered.push(tool);
      } else if (rendered.length && rendered[rendered.length - 1] !== RICH_TEXT_EDITOR_TOOLS.DIVIDER) {
        rendered.push(tool);
      }
    }

    if (rendered[rendered.length - 1] === RICH_TEXT_EDITOR_TOOLS.DIVIDER) rendered.pop();

    return rendered;
  });

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<RichTextEditorLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /** @internal `null` when no codec is installed, in which case token markdown stays plain text. */
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

  private boldActiveState = signal(false);
  public boldActive = this.boldActiveState.asReadonly();
  private italicActiveState = signal(false);
  public italicActive = this.italicActiveState.asReadonly();
  private strikeActiveState = signal(false);
  public strikeActive = this.strikeActiveState.asReadonly();
  private underlineActiveState = signal(false);
  public underlineActive = this.underlineActiveState.asReadonly();
  private codeActiveState = signal(false);
  public codeActive = this.codeActiveState.asReadonly();
  private unorderedListActiveState = signal(false);
  public unorderedListActive = this.unorderedListActiveState.asReadonly();
  private orderedListActiveState = signal(false);
  public orderedListActive = this.orderedListActiveState.asReadonly();
  private linkActiveState = signal(false);
  public linkActive = this.linkActiveState.asReadonly();
  private blockquoteActiveState = signal(false);
  public blockquoteActive = this.blockquoteActiveState.asReadonly();

  /** Whether the caret sits in a fenced code block, where the value is literal text. */
  private codeBlockActiveState = signal(false);
  public codeBlockActive = this.codeBlockActiveState.asReadonly();

  private headingLevelState = signal<RichTextEditorHeadingLevel | null>(null);
  public headingLevel = this.headingLevelState.asReadonly();

  /** Whether the selection sits inside a table cell. */
  private inTableCellState = signal(false);
  public inTableCell = this.inTableCellState.asReadonly();

  public headingToolDisabled = computed(
    () =>
      this.inTableCell() ||
      this.unorderedListActive() ||
      this.orderedListActive() ||
      this.blockquoteActive() ||
      this.codeBlockActive(),
  );

  private inList = computed(() => this.unorderedListActive() || this.orderedListActive());

  public listToolDisabled = computed(() => this.inTableCell() || this.blockquoteActive() || this.codeBlockActive());

  public blockquoteToolDisabled = computed(() => this.inTableCell() || this.codeBlockActive() || this.inList());

  public codeBlockToolDisabled = computed(() => this.inTableCell() || this.blockquoteActive() || this.inList());

  /** @internal `null` means "follow the caret"; a list means the next typed text is wrapped in exactly these marks. */
  public pendingMarks = signal<InlineTag[] | null>(null);

  /** @internal Autoformat rules keyed on these characters never fire, so a `#` trigger keeps opening its autocomplete instead of becoming a heading. */
  public autoformatReservedChars = signal<readonly string[]>([]);

  /** @internal `true` while a token-trigger popup run is active - suspends all autoformat. */
  public autoformatSuppressed = signal(false);

  /** @internal */
  public parsePastedTokens = signal(true);

  /** @internal */
  public lastEmittedMarkdown: string | null = null;

  /** @internal `null` for a bare `[etRichTextEditor]` with no popover, where {@link promptForLink} falls back to a native prompt. */
  public openLinkEditor = signal<(() => void) | null>(null);

  /** @internal */
  public linkEditorOpen = signal(false);

  constructor() {
    mountEasingTokens();
    super();

    injectStyleManager().mount(FormFieldRichTextStylesComponent);

    mountTextFieldShellStyles();

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
    this.destroyRef.onDestroy(() => {
      for (const tool of this.registeredTools) tool.editorDestroyed?.(this);
    });

    fromEvent(this.document, 'selectionchange')
      .pipe(
        tap(() => {
          this.refreshActiveMarks();
          this.recordHistorySelection();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    if (ngDevMode) this.warnAboutMissingTools();

    // Skips the user's own edits: those already match `lastEmittedMarkdown`, and re-rendering them would reset the caret.
    effect(() => {
      const markdown = this.value();

      if (markdown === this.lastEmittedMarkdown) return;

      this.renderExternalValue(markdown);
    });
  }

  /**
   * Attaches the `contenteditable` element this editor edits and renders the current value into it.
   * A headless host calls it once its element exists, and forwards the element's `input` event to `syncFromDom()`.
   */
  public attachEditable(element: HTMLElement | null) {
    this.editorDom.root.set(element);

    if (element) this.renderExternalValue();
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
   * funnels through.
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

    // Applied after reading, so it can never change what was read.
    this.normalizeContent(root);

    this.lastEmittedMarkdown = markdown;
    this.value.set(markdown);
    this.history.commit({ value: markdown, selection: this.editorDom.readSelectionOffsets() }, opts?.boundary);
    this.refreshActiveMarks();
  }

  /** @internal */
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

  /** @internal Restarts the history: an outside write is a new document, so undo must not reach back into the previous one's states. */
  public renderExternalValue(markdown = this.value()) {
    if (!this.writeValueToDom(markdown)) return;

    this.history.reset(markdown);
  }

  public refreshActiveMarks() {
    const pending = this.pendingMarks();

    if (pending !== null) {
      const states = this.editorDom.markStates();

      this.reflectMarks(inlineMarkStates(pending));
      this.reflectBlockStates(states);

      return;
    }

    const states = this.editorDom.markStates();

    this.reflectMarks(states);
    this.unorderedListActiveState.set(states?.unorderedList ?? false);
    this.orderedListActiveState.set(states?.orderedList ?? false);
    this.linkActiveState.set(states?.link ?? false);
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
   * Runs markdown autoformat for a single typed character (called from `beforeinput`). Returns `true`
   * when the character was consumed by a conversion.
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

  /** Turns the selected blocks into a fenced code block, or a code block back into paragraphs - only
   *  the text survives either way. Needs `provideRichTextEditorCodeBlockTool()`. */
  public toggleCodeBlock() {
    const { codeBlock } = this.editorDom;

    if (!codeBlock) {
      if (ngDevMode) throw missingDomFeature('toggleCodeBlock', 'provideRichTextEditorCodeBlockTool');

      return;
    }

    this.runCommand(() => codeBlock.toggleCodeBlock());
  }

  /** Needs `provideRichTextEditorHeadingTool()`. */
  public toggleHeading(level: RichTextEditorHeadingLevel) {
    const { headings } = this.editorDom;

    if (!headings) {
      if (ngDevMode) throw missingDomFeature('toggleHeading', 'provideRichTextEditorHeadingTool');

      return;
    }

    this.runCommand(() => headings.toggleHeading(`h${level}`));
  }

  /** Needs `provideRichTextEditorHeadingTool()`. */
  public setHeading(level: RichTextEditorHeadingLevel | null) {
    const current = this.headingLevel();

    if (level === current) return;

    // `toggleHeading` turns a heading back into a paragraph only when handed its own level.
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

    if (url && !isSafeLinkUrl(url)) return;

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

    if (this.linkActive()) {
      this.removeLink();

      return;
    }

    const url = this.document.defaultView?.prompt(this.resolvedLabels().linkPrompt);

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

    // Chromium checks style-src-attr for every parsed style attribute, even in a DOMParser,
    // createHTMLDocument or <template> document, so the attribute is renamed before parsing.
    const body = new DOMParser().parseFromString(renameStyleAttributes(html), 'text/html').body;

    // eslint-disable-next-line ethlete/no-dom-query -- clipboard HTML (e.g. from Word) embeds <style> blocks whose CSS text would survive the tag-strip as plain text
    body.querySelectorAll('style, script, noscript, meta, link, title').forEach((junk) => junk.remove());

    if (this.editorDom.markStates()?.codeBlock) return this.pasteIntoCodeBlock(clipboardPlainText(body));

    const codec = this.tokenCodec();

    this.parseTokensInText(body);
    this.serializeTokens(body);

    const markdown = htmlToMarkdown(restoreStyleAttributes(body.innerHTML));

    if (!markdown) return false;

    const normalized = markdownToHtml(markdown, { verbatim: codec?.markdownPattern });

    this.editorDom.insertNormalizedHtml(codec ? codec.render(normalized) : normalized);

    const root = this.editorDom.root();

    if (codec && root) codec.hydrate(root);

    this.syncFromDom({ boundary: true });

    return true;
  }

  /**
   * Inserts plain clipboard text, recognizing tokens written the way they read - `#User Name` - and
   * turning them back into chips. Everything else stays literal; with nothing to recognize this
   * returns `false` so the browser inserts the text itself.
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
   * trigger popup - resolving its label via the matching trigger's `resolveItem`.
   *
   * Inserts at the current caret, or - if the editor isn't focused - at the position it last held,
   * falling back to the end of the content. The caret is left after the chip. A token codec must be
   * installed (by `[etRichTextEditorTriggers]` or `provideRichTextEditorTokenRendering`); without one
   * this throws in dev and no-ops in production.
   *
   * @param opts.focus Focus the editor after inserting so the user can keep typing. @default true
   */
  // eslint-disable-next-line max-params -- (type, id, opts?) is the documented public API shape, mirroring common editor insert methods
  public insertToken(type: string, id: string, opts?: { focus?: boolean }) {
    const codec = this.requireTokenCodec();

    if (!codec) return;
    if (ngDevMode) assertValidToken(type, id);

    this.insertChip(codec.resolveChip(type, id), { focus: opts?.focus, hydrate: true });
  }

  /**
   * Like {@link insertToken}, but for when the app already holds the resolved `{ id, label }` item
   * (e.g. the row a palette button represents) - the label is used as-is, skipping resolution.
   *
   * @param opts.focus Focus the editor after inserting so the user can keep typing. @default true
   */
  // eslint-disable-next-line max-params -- (type, item, opts?) mirrors insertToken's documented public API shape
  public insertTokenItem(type: string, item: RichTextEditorTriggerItem, opts?: { focus?: boolean }) {
    const codec = this.requireTokenCodec();

    if (!codec || item.disabled) return;
    if (ngDevMode) assertValidToken(type, item.id);

    this.insertChip({ ...codec.resolveChip(type, item.id), label: item.label }, { focus: opts?.focus, hydrate: false });
  }

  private warnAboutMissingTools() {
    const warned = new Set<string>();

    effect(() => {
      const configured =
        this.tools() ?? (this.toolsConfig.tools === DEFAULT_RICH_TEXT_EDITOR_TOOLS ? [] : this.toolsConfig.tools);

      for (const tool of configured) {
        if (tool === RICH_TEXT_EDITOR_TOOLS.DIVIDER || this.toolDefs.has(tool) || warned.has(tool)) continue;

        warned.add(tool);
        console.warn(missingToolWarning(tool));
      }
    });
  }

  private pasteIntoCodeBlock(text: string) {
    if (!text) return false;

    this.editorDom.insertNormalizedHtml(escapeHtmlText(text));
    this.syncFromDom({ boundary: true });

    return true;
  }

  private parseTokensInText(root: HTMLElement) {
    const codec = this.tokenCodec();

    if (!codec || !this.parsePastedTokens()) return;

    for (const node of collectTextNodes(root)) {
      // eslint-disable-next-line ethlete/no-dom-query -- a detached clipboard document, no component tree to inject from
      if (node.parentElement?.closest('code, pre')) continue;

      const parsed = codec.parseTokenText(node.data);

      if (parsed === node.data) continue;

      const template = this.renderer.createElement('template') as HTMLTemplateElement;

      template.innerHTML = codec.render(escapeHtmlText(parsed));
      node.replaceWith(template.content);
    }
  }

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
    this.editorDom.insertToken(this.renderer.createText(' '));

    if (hydrate) this.tokenCodec()?.hydrate(root);

    this.syncFromDom({ boundary: true });

    // Focus last so the caret placed after the nbsp stays live. Skip when already focused -
    // re-focusing a contenteditable that holds the caret collapses the selection to its start.
    if ((focus ?? true) && root.ownerDocument.activeElement !== root) root.focus();
  }

  private normalizeContent(root: HTMLElement) {
    for (const tool of this.registeredTools) tool.normalize?.(root);
  }

  private serializeTokens(root: HTMLElement) {
    const codec = this.tokenCodec();

    if (!codec) return;

    const existing = new Set(collectTextNodes(root));

    codec.serialize(root);

    for (const node of collectTextNodes(root)) {
      if (existing.has(node) || !node.data) continue;

      const verbatim = this.renderer.createElement('span') as HTMLElement;

      this.renderer.setAttribute(verbatim, MARKDOWN_VERBATIM_ATTR, '');
      node.replaceWith(verbatim);
      this.renderer.appendChild(verbatim, node);
    }
  }

  private serializeCleanHtml(root: HTMLElement) {
    const clone = root.cloneNode(true) as HTMLElement;

    // Must run before the HTML→markdown pass strips unknown tags, which would flatten a chip to its label.
    this.serializeTokens(clone);
    wrapLineBeforeNativeDiv(clone, this.renderer);

    let removed = true;

    while (removed) {
      removed = false;

      // eslint-disable-next-line ethlete/no-dom-query
      clone.querySelectorAll(EMPTY_INLINE_SWEEP_SELECTOR).forEach((el) => {
        if ((el.textContent ?? '').length === 0) {
          el.remove();
          removed = true;
        }
      });
    }

    // eslint-disable-next-line ethlete/no-dom-query
    clone.querySelectorAll('div').forEach((div) => {
      const paragraph = this.renderer.createElement('p') as HTMLElement;

      while (div.firstChild) this.renderer.appendChild(paragraph, div.firstChild);
      div.replaceWith(paragraph);
    });

    // drop zero-width spaces used transiently to park the caret outside an inline mark (code exit)
    return clone.innerHTML.replace(/\u200b/g, '');
  }

  private toggleMark(tag: InlineTag) {
    if (this.disabled() || this.readonly()) return;

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
    this.reflectMarks(inlineMarkStates(next));
  }

  private reflectBlockStates(states: RichTextMarkStates | null) {
    this.blockquoteActiveState.set(states?.blockquote ?? false);
    this.codeBlockActiveState.set(states?.codeBlock ?? false);
    this.headingLevelState.set(states?.heading ?? null);
    this.inTableCellState.set(states?.tableCell ?? false);
  }

  private reflectMarks(states: InlineMarkStates | null) {
    this.boldActiveState.set(states?.bold ?? false);
    this.italicActiveState.set(states?.italic ?? false);
    this.strikeActiveState.set(states?.strike ?? false);
    this.underlineActiveState.set(states?.underline ?? false);
    this.codeActiveState.set(states?.code ?? false);
  }

  private runCommand(command: () => void) {
    if (!this.canEdit()) return;

    this.editorDom.restoreSelection();

    command();
    this.syncFromDom({ boundary: true });
  }

  private canEdit() {
    return !this.disabled() && !this.readonly() && !!this.editorDom.root();
  }

  private applyHistoryEntry(entry: RichTextEditorHistoryEntry | null) {
    if (!entry) return;

    this.clearPendingMarks();
    this.writeValueToDom(entry.value);
    this.value.set(entry.value);
    this.editorDom.restoreSelectionOffsets(entry.selection);
    this.refreshActiveMarks();
  }

  private writeValueToDom(markdown: string) {
    const root = this.editorDom.root();

    if (!root) return false;

    const codec = this.tokenCodec();
    const html = markdownToHtml(markdown, { verbatim: codec?.markdownPattern });

    root.innerHTML = codec ? codec.render(html) : html;
    codec?.hydrate(root);
    this.normalizeContent(root);
    // the DOM now matches this value, so the render effect skips it as "already emitted"
    this.lastEmittedMarkdown = markdown;

    return true;
  }
}
