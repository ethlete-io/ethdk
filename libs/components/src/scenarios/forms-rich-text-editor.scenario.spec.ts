import { afterNextRender, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  createRichTextEditorTrigger,
  DEFAULT_RICH_TEXT_EDITOR_LABELS,
  DEFAULT_RICH_TEXT_EDITOR_TOOLS,
  FORM_FIELD_IMPORTS,
  injectRichTextEditorLabels,
  injectRichTextEditorTools,
  provideOverlay,
  provideRichTextEditorAutoformat,
  provideRichTextEditorBlockquoteTool,
  provideRichTextEditorCodeBlockTool,
  provideRichTextEditorDefaultTools,
  provideRichTextEditorHeadingTool,
  provideRichTextEditorLabels,
  provideRichTextEditorLinkTool,
  provideRichTextEditorTokenRendering,
  provideRichTextEditorTools,
  RICH_TEXT_EDITOR_HEADING_OPTIONS,
  RICH_TEXT_EDITOR_IMPORTS,
  RICH_TEXT_EDITOR_INLINE_TOOLS,
  RICH_TEXT_EDITOR_LABELS,
  RICH_TEXT_EDITOR_TOOL,
  RICH_TEXT_EDITOR_TOOL_BUTTONS,
  RICH_TEXT_EDITOR_TOOLS,
  RichTextEditorComponent,
  RichTextEditorDirective,
  RichTextEditorHeadingToolComponent,
  RichTextEditorTool,
  RichTextEditorToolDefinition,
  richTextEditorToolLabel,
  RichTextViewerComponent,
} from '../index';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

@Component({
  selector: 'et-scenario-article-form',
  imports: [RICH_TEXT_EDITOR_IMPORTS, FORM_FIELD_IMPORTS, FormField],
  providers: [provideRichTextEditorDefaultTools()],
  template: `
    <et-form-field>
      <et-label>Body</et-label>
      <et-rich-text-editor [formField]="articleForm.body" placeholder="Write the article" />
    </et-form-field>
  `,
})
class ArticleFormComponent {
  model = signal({ body: 'Hello **world**' });
  locked = signal(false);
  articleForm = form(this.model, (path) => {
    required(path.body, { message: 'Write the article body' });
    disabled(path.body, () => this.locked());
  });
}

@Component({
  selector: 'et-scenario-note-box',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [
    provideRichTextEditorHeadingTool(),
    provideRichTextEditorBlockquoteTool(),
    provideRichTextEditorCodeBlockTool(),
    provideRichTextEditorAutoformat(),
  ],
  template: `<et-rich-text-editor
    [(value)]="note"
    [autoformat]="autoformat()"
    [readonly]="readonly()"
    aria-label="Note"
  />`,
})
class NoteBoxComponent {
  note = signal('');
  autoformat = signal(true);
  readonly = signal(false);
}

@Component({
  selector: 'et-scenario-comment-box',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [
    provideRichTextEditorLinkTool(),
    provideRichTextEditorTools(['bold', 'italic', 'link']),
    provideRichTextEditorLabels({ linkPrompt: 'Link-Adresse' }),
  ],
  template: `<et-rich-text-editor [(value)]="comment" [tools]="tools()" aria-label="Comment" />`,
})
class CommentBoxComponent {
  comment = signal('');
  tools = signal<readonly RichTextEditorTool[] | null>(null);
  configured = injectRichTextEditorTools();
}

const SHOUT_TOOL: RichTextEditorToolDefinition = {
  token: 'shout',
  label: 'Shout',
  icon: 'et-bold',
  run: (editor) => editor.value.set(editor.value().toUpperCase()),
};

@Component({
  selector: 'et-scenario-localized-editor',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [
    provideRichTextEditorLabels({
      toolbar: 'Textformatierung',
      bold: 'Fett',
      heading: (level) => `Überschrift ${level}`,
    }),
    provideRichTextEditorHeadingTool(),
    { provide: RICH_TEXT_EDITOR_TOOL, useValue: SHOUT_TOOL, multi: true },
  ],
  template: `<et-rich-text-editor [(value)]="text" [tools]="tools" [labels]="overrides()" aria-label="Text" />`,
})
class LocalizedEditorComponent {
  text = signal('quiet');
  tools: RichTextEditorTool[] = ['heading', 'bold', 'shout'];
  overrides = signal<{ italic?: string } | null>(null);
  labels = injectRichTextEditorLabels();
  labelsFromToken = inject(RICH_TEXT_EDITOR_LABELS);
}

const PEOPLE = [{ id: 'ada', label: 'Ada Lovelace' }];

@Component({
  selector: 'et-scenario-article-view',
  imports: [RichTextViewerComponent],
  providers: [
    provideRichTextEditorTokenRendering([
      createRichTextEditorTrigger({
        char: '@',
        type: 'mention',
        items: PEOPLE,
        resolveItem: (id) => PEOPLE.find((person) => person.id === id) ?? null,
      }),
    ]),
  ],
  template: `<et-rich-text-viewer [value]="body()" />`,
})
class ArticleViewComponent {
  body = signal<string | null>('# Title\n\nBy {{mention:ada}}');
}

@Component({
  selector: 'et-scenario-bare-editor',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  template: `<et-rich-text-editor aria-label="Bare" />`,
})
class BareEditorComponent {}

@Component({
  selector: 'et-scenario-headless-notes',
  imports: [RichTextEditorDirective],
  template: `
    <div #notesEditor="etRichTextEditor" [(value)]="notes" etRichTextEditor aria-label="Notes">
      <button (click)="notesEditor.toggleBold()" type="button">Bold</button>
      <div #editable (input)="notesEditor.syncFromDom()" class="notes-editable" contenteditable="true"></div>
    </div>
  `,
})
class HeadlessNotesComponent {
  notes = signal('Draft **one**');
  editor = viewChild.required(RichTextEditorDirective);
  editable = viewChild.required<ElementRef<HTMLElement>>('editable');

  constructor() {
    afterNextRender(() => this.editor().attachEditable(this.editable().nativeElement));
  }
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const textbox = (root: ParentNode) => query('[role="textbox"]', root);

const toolButton = (root: ParentNode, label: string) =>
  query<HTMLButtonElement>(`.et-rte-toolbar button[aria-label="${label}"]`, root);

const toolbarLabels = (root: ParentNode) =>
  Array.from(root.querySelectorAll('.et-rte-toolbar button')).map((button) => button.getAttribute('aria-label'));

const editorOf = (fixture: ComponentFixture<unknown>) =>
  fixture.debugElement.query(By.directive(RichTextEditorComponent)).injector.get(RichTextEditorDirective);

const textPoint = (root: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let position = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const length = (node as Text).data.length;

    if (position + length >= offset) return { node, offset: offset - position };

    position += length;
  }

  throw new Error(`no text at ${offset}`);
};

const selectText = (root: HTMLElement, start: number, end = start) => {
  const from = textPoint(root, start);
  const to = textPoint(root, end);
  const range = document.createRange();

  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
};

const caretAtEnd = (root: HTMLElement) => selectText(root, (root.textContent ?? '').length);

const caretInEmpty = (root: HTMLElement) => {
  const range = document.createRange();

  range.setStart(root, 0);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
};

const typeText = (s: Scenario, root: HTMLElement, text: string) => {
  for (const char of text) {
    const before = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: char,
    });

    root.dispatchEvent(before);
    s.tick();

    if (before.defaultPrevented) continue;

    const range = document.getSelection()!.getRangeAt(0);

    range.deleteContents();

    if (range.startContainer instanceof Text) {
      const offset = range.startOffset;

      range.startContainer.insertData(offset, char);
      range.setStart(range.startContainer, offset + char.length);
    } else {
      const node = document.createTextNode(char);

      range.insertNode(node);
      range.setStart(node, char.length);
    }

    range.collapse(true);
    root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
    s.tick();
  }
};

const paste = (s: Scenario, root: HTMLElement, data: { html?: string; text?: string; files?: File[] }) => {
  const event = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clipboardData', {
    value: {
      files: data.files ?? [],
      types: [...(data.html ? ['text/html'] : []), ...(data.text ? ['text/plain'] : [])],
      getData: (type: string) => (type === 'text/html' ? (data.html ?? '') : (data.text ?? '')),
    },
  });
  root.dispatchEvent(event);
  s.tick();

  return event;
};

const menuItemLabel = (item: Element) => item.textContent?.trim().split('\n')[0]?.trim();

const menuItem = (label: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('et-menu-radio-item')).find(
    (item) => menuItemLabel(item) === label,
  ) ?? null;

describe('forms rich-text-editor scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('binds a signal form field: renders its Markdown, writes edits back, and follows required and disabled', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ArticleFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;

    s.flush();

    const editable = textbox(host);

    expect(editable.innerHTML).toBe('<p>Hello <strong>world</strong></p>');
    expect(editable.getAttribute('aria-required')).toBe('true');
    expect(editable.getAttribute('data-placeholder')).toBe('Write the article');
    expect(editable.getAttribute('aria-labelledby')).toBe(query('et-label', host).id);

    editable.focus();
    caretAtEnd(editable);
    typeText(s, editable, ' again');
    expect(page.model().body).toBe('Hello **world again**');

    selectText(editable, 0, 5);
    s.tick();
    toolButton(host, 'Italic').click();
    s.tick();
    expect(page.model().body).toBe('*Hello* **world again**');
    expect(toolButton(host, 'Italic').getAttribute('aria-pressed')).toBe('true');
    expect(toolButton(host, 'Bold').getAttribute('aria-pressed')).toBe('false');

    selectText(editable, 0, editable.textContent!.length);
    document.getSelection()!.getRangeAt(0).deleteContents();
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    s.tick();
    expect(page.model().body).toBe('');
    expect(editable.hasAttribute('aria-invalid')).toBe(false);

    editable.blur();
    s.tick();
    expect(page.articleForm.body().touched()).toBe(true);
    expect(editable.getAttribute('aria-invalid')).toBe('true');

    page.model.set({ body: '- one\n- two' });
    s.tick();
    expect(editable.querySelectorAll('ul li').length).toBe(2);
    expect(toolButton(host, 'Undo').disabled).toBe(true);

    page.locked.set(true);
    s.tick();
    expect(editable.getAttribute('contenteditable')).toBe('false');
    expect(editable.getAttribute('aria-disabled')).toBe('true');
    expect(editable.getAttribute('tabindex')).toBe('-1');
    expect(toolButton(host, 'Bold').disabled).toBe(true);
    expect(toolButton(host, 'Text style: Normal').disabled).toBe(true);
    s.flush();
  });

  it('undoes and redoes through the toolbar and the keyboard, one programmatic rewrite at a time', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NoteBoxComponent);
    const host = fixture.nativeElement as HTMLElement;
    const note = fixture.componentInstance.note;

    s.flush();

    const editable = textbox(host);

    editable.focus();
    caretInEmpty(editable);
    typeText(s, editable, 'draft');
    expect(note()).toBe('draft');

    selectText(editable, 0, 5);
    toolButton(host, 'Bold').click();
    s.tick();
    expect(note()).toBe('**draft**');

    toolButton(host, 'Undo').click();
    s.tick();
    expect(note()).toBe('draft');
    expect(toolButton(host, 'Redo').disabled).toBe(false);

    const redo = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true });

    editable.dispatchEvent(redo);
    s.tick();
    expect(redo.defaultPrevented).toBe(true);
    expect(note()).toBe('**draft**');

    const undo = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });

    editable.dispatchEvent(undo);
    s.tick();
    expect(note()).toBe('draft');
    s.flush();
  });

  it('turns Markdown typed at a line start into blocks and marks, unless autoformat is off', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NoteBoxComponent);
    const host = fixture.nativeElement as HTMLElement;
    const box = fixture.componentInstance;

    s.flush();

    const editable = textbox(host);

    editable.focus();
    caretInEmpty(editable);
    typeText(s, editable, '## Plan');
    expect(editable.querySelector('h2')?.textContent).toBe('Plan');
    expect(box.note()).toBe('## Plan');
    expect(toolButton(host, 'Text style: Heading 2')).not.toBeNull();

    box.note.set('');
    s.tick();
    caretInEmpty(editable);
    typeText(s, editable, '> quoted **loud** ');
    expect(editable.querySelector('blockquote strong')?.textContent).toBe('loud');
    expect(box.note()).toBe('> quoted **loud**');
    expect(toolButton(host, 'Block quote').getAttribute('aria-pressed')).toBe('true');
    expect(toolButton(host, 'Bulleted list').disabled).toBe(true);

    box.note.set('');
    box.autoformat.set(false);
    s.tick();
    caretInEmpty(editable);
    typeText(s, editable, '- not a list');
    expect(editable.querySelector('ul')).toBeNull();
    expect(box.note()).toBe('\\- not a list');
    s.flush();
  });

  it('keeps Markdown syntax typed as literal text literal once the value is loaded again', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NoteBoxComponent);
    const host = fixture.nativeElement as HTMLElement;
    const box = fixture.componentInstance;

    box.autoformat.set(false);
    s.flush();

    const editable = textbox(host);

    editable.focus();
    caretInEmpty(editable);
    typeText(s, editable, '- not a list');

    const stored = box.note();

    box.note.set('');
    s.tick();
    box.note.set(stored);
    s.tick();
    expect(editable.querySelector('ul')).toBeNull();
    expect(editable.textContent).toBe('- not a list');
  });

  it('switches block styles through the heading menu and fences code from the toolbar', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NoteBoxComponent);
    const host = fixture.nativeElement as HTMLElement;
    const box = fixture.componentInstance;

    box.note.set('Roadmap');
    s.flush();

    const editable = textbox(host);

    expect(fixture.debugElement.query(By.directive(RichTextEditorHeadingToolComponent))).not.toBeNull();

    editable.focus();
    selectText(editable, 2);
    s.tick();
    toolButton(host, 'Text style: Normal').click();
    s.flush();

    expect(Array.from(document.querySelectorAll('et-menu-radio-item')).map(menuItemLabel)).toEqual(
      RICH_TEXT_EDITOR_HEADING_OPTIONS.map((option) => option.label),
    );

    menuItem('Heading 1')!.click();
    s.flush();
    expect(box.note()).toBe('# Roadmap');
    expect(editable.querySelector('h1')).not.toBeNull();

    selectText(editable, 2);
    toolButton(host, 'Code block').click();
    s.tick();
    expect(box.note()).toBe('```\nRoadmap\n```');
    expect(toolButton(host, 'Code block').getAttribute('aria-pressed')).toBe('true');
    expect(toolButton(host, 'Bold').disabled).toBe(true);

    box.readonly.set(true);
    s.tick();
    expect(editable.getAttribute('contenteditable')).toBe('false');
    expect(editable.getAttribute('aria-readonly')).toBe('true');
    expect(toolButton(host, 'Code block').disabled).toBe(true);
    s.flush();
  });

  it('sanitizes pasted HTML into the schema and refuses a bare pasted file', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NoteBoxComponent);
    const host = fixture.nativeElement as HTMLElement;
    const note = fixture.componentInstance.note;

    s.flush();

    const editable = textbox(host);

    editable.focus();
    caretInEmpty(editable);

    const event = paste(s, editable, {
      html: '<style>p{color:red}</style><p style="color:red" onclick="steal()">Hi <b>there</b><script>steal()</script> <a href="javascript:steal()">x</a></p>',
    });

    expect(event.defaultPrevented).toBe(true);
    expect(editable.innerHTML).toBe('Hi <strong>there</strong> x');
    expect(editable.querySelector('a, script, style, [onclick], [style]')).toBeNull();
    expect(note()).toBe('Hi **there** x');

    const file = paste(s, editable, { files: [new File(['x'], 'shot.png', { type: 'image/png' })] });

    expect(file.defaultPrevented).toBe(true);
    expect(note()).toBe('Hi **there** x');
  });

  it('configures the toolbar per scope and per instance, and falls back to the native prompt for links', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CommentBoxComponent);
    const host = fixture.nativeElement as HTMLElement;
    const box = fixture.componentInstance;

    s.flush();

    expect(DEFAULT_RICH_TEXT_EDITOR_TOOLS).toContain(RICH_TEXT_EDITOR_TOOLS.HEADING);
    expect(box.configured.tools).toEqual(['bold', 'italic', 'link']);
    expect(toolbarLabels(host)).toEqual(['Bold', 'Italic', 'Link']);

    box.tools.set([...RICH_TEXT_EDITOR_INLINE_TOOLS, RICH_TEXT_EDITOR_TOOLS.DIVIDER, RICH_TEXT_EDITOR_TOOLS.UNDO]);
    s.tick();
    expect(toolbarLabels(host)).toEqual([
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Inline code',
      'Link',
      'Undo',
    ]);
    expect(host.querySelectorAll('.et-rte-toolbar et-divider').length).toBe(1);
    expect(RICH_TEXT_EDITOR_TOOL_BUTTONS.underline?.label).toBe(DEFAULT_RICH_TEXT_EDITOR_LABELS.underline);

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('https://example.com/docs');
    const editable = textbox(host);

    editable.focus();
    caretInEmpty(editable);
    typeText(s, editable, 'read docs');
    selectText(editable, 5, 9);
    toolButton(host, 'Link').click();
    s.tick();
    expect(promptSpy).toHaveBeenCalledExactlyOnceWith('Link-Adresse');
    expect(box.comment()).toBe('read [docs](https://example.com/docs)');

    selectText(editable, 6);
    s.tick();
    expect(toolButton(host, 'Link').getAttribute('aria-pressed')).toBe('true');
    toolButton(host, 'Link').click();
    s.tick();
    expect(box.comment()).toBe('read docs');
    expect(promptSpy).toHaveBeenCalledOnce();

    promptSpy.mockReturnValue(' JavaScript:steal()');
    selectText(editable, 5, 9);
    s.tick();
    toolButton(host, 'Link').click();
    s.tick();
    expect(promptSpy).toHaveBeenCalledTimes(2);
    expect(editable.querySelector('a')).toBeNull();
    expect(box.comment()).toBe('read docs');
    s.flush();
  });

  it('localizes the toolbar from the scope and the instance, and names app tools by their own label', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LocalizedEditorComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;

    s.flush();

    expect(page.labels().bold).toBe('Fett');
    expect(page.labels().italic).toBe(DEFAULT_RICH_TEXT_EDITOR_LABELS.italic);
    expect(page.labelsFromToken).toBeDefined();
    expect(query('.et-rte-toolbar', host).getAttribute('aria-label')).toBe('Textformatierung');
    expect(toolbarLabels(host)).toEqual(['Text style: Normal', 'Fett', 'Shout']);
    expect(richTextEditorToolLabel(page.labels(), SHOUT_TOOL)).toBe('Shout');
    expect(richTextEditorToolLabel(page.labels(), { token: 'bold', label: 'unused' })).toBe('Fett');

    toolButton(host, 'Text style: Normal').click();
    s.flush();
    expect(menuItem('Überschrift 2')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    s.flush();

    toolButton(host, 'Shout').click();
    s.tick();
    expect(page.text()).toBe('QUIET');
    expect(textbox(host).textContent).toBe('QUIET');
    s.flush();
  });

  it('names the provider a command needs when the editor was set up without it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BareEditorComponent);

    s.flush();

    const editor = editorOf(fixture);

    expect(() => editor.toggleHeading(1)).toThrow(/provideRichTextEditorHeadingTool/);
    expect(() => editor.applyLink('https://example.com')).toThrow(/provideRichTextEditorLinkTool/);
    expect(toolbarLabels(fixture.nativeElement)).toEqual([
      'Undo',
      'Redo',
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Inline code',
      'Bulleted list',
      'Numbered list',
    ]);
  });

  it('renders a stored value read-only with token chips and without unsafe markup', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ArticleViewComponent);
    const host = fixture.nativeElement as HTMLElement;
    const view = fixture.componentInstance;

    s.flush();

    const viewer = query('et-rich-text-viewer', host);

    expect(viewer.querySelector('h1')?.textContent).toBe('Title');
    expect(viewer.querySelector('[data-et-token]')?.textContent).toContain('Ada Lovelace');

    view.body.set('<img src=x onerror="steal()"> [bad](javascript:steal()) [ok](https://example.com)');
    s.tick();
    expect(viewer.querySelector('img')).toBeNull();
    expect(viewer.textContent).toContain('bad)');
    expect(viewer.textContent).not.toContain('javascript:');
    expect(Array.from(viewer.querySelectorAll('a')).map((link) => link.getAttribute('href'))).toEqual([
      'https://example.com',
    ]);

    view.body.set(null);
    s.tick();
    expect(viewer.innerHTML).toBe('');
  });
  it('lets a headless host attach its own editable element and edit through it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessNotesComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;

    s.flush();

    const editable = query('.notes-editable', host);

    expect(editable.innerHTML).toBe('<p>Draft <strong>one</strong></p>');

    editable.focus();
    caretAtEnd(editable);
    typeText(s, editable, ' more');
    expect(page.notes()).toBe('Draft **one more**');

    selectText(editable, 0, 5);
    query<HTMLButtonElement>('button', host).click();
    s.tick();
    expect(page.notes()).toBe('**Draft** **one more**');

    page.notes.set('Replaced');
    s.tick();
    expect(editable.innerHTML).toBe('<p>Replaced</p>');
  });
});
