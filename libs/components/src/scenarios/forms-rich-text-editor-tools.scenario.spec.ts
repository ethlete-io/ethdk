import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, ElementRef, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ColorTheme, markdownToHtml, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import { Subject } from 'rxjs';
import {
  createRichTextEditorTrigger,
  createRichTextEditorTriggerWithQuery,
  DEFAULT_RICH_TEXT_EDITOR_LABELS,
  mountRichTextEditorImageStyles,
  mountRichTextEditorTableStyles,
  provideOverlay,
  provideRichTextEditorAlignmentTool,
  provideRichTextEditorFloatingToolbar,
  provideRichTextEditorImageTool,
  provideRichTextEditorLinkEditor,
  provideRichTextEditorLinkTool,
  provideRichTextEditorTableTool,
  provideRichTextEditorTokenRendering,
  RICH_TEXT_EDITOR_FLOATING_TOOLBAR,
  RICH_TEXT_EDITOR_IMPORTS,
  RICH_TEXT_EDITOR_LINK_EDITOR,
  RICH_TEXT_EDITOR_TOKEN_CODEC,
  RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS,
  RICH_TEXT_EDITOR_TRIGGERS_IMPORTS,
  RichTextEditorAlignToolComponent,
  RichTextEditorDirective,
  RichTextEditorFloatingToolbarComponent,
  RichTextEditorFloatingToolbarDirective,
  RichTextEditorImageEditorComponent,
  RichTextEditorImageFailure,
  RichTextEditorImageStylesComponent,
  RichTextEditorImageToolComponent,
  RichTextEditorLinkEditorComponent,
  RichTextEditorLinkEditorDirective,
  RichTextEditorTableStylesComponent,
  RichTextEditorTableToolComponent,
  RichTextEditorTokenPaletteComponent,
  RichTextEditorTokenPopupComponent,
  RichTextEditorTrigger,
  RichTextEditorTriggersDirective,
  setupRichTextEditorFloatingToolbar,
  setupRichTextEditorLinkEditor,
  startImageUpload,
  TEXT_ALIGNS,
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

const linkEditorSetups: HTMLElement[] = [];

@Component({
  selector: 'et-scenario-link-page',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [
    provideRichTextEditorLinkTool(),
    provideRichTextEditorLinkEditor(),
    {
      provide: RICH_TEXT_EDITOR_LINK_EDITOR,
      useValue: (editor: RichTextEditorDirective, host: HTMLElement) => {
        linkEditorSetups.push(host);
        setupRichTextEditorLinkEditor(editor, host);
      },
    },
  ],
  template: `<et-rich-text-editor [(value)]="text" [tools]="['link']" aria-label="Text" />`,
})
class LinkPageComponent {
  text = signal('read docs');
}

@Component({
  selector: 'et-scenario-headless-link-page',
  imports: [RICH_TEXT_EDITOR_IMPORTS, RichTextEditorLinkEditorDirective, RichTextEditorFloatingToolbarDirective],
  providers: [provideRichTextEditorLinkTool()],
  template: `
    <et-rich-text-editor
      [(value)]="text"
      [tools]="['bold', 'link']"
      aria-label="Text"
      etRichTextEditorLinkEditor
      etRichTextEditorFloatingToolbar
    />
  `,
})
class DirectiveToolsPageComponent {
  text = signal('plain words');
}

let floatingToolbarSetups = 0;

@Component({
  selector: 'et-scenario-floating-page',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [
    provideRichTextEditorFloatingToolbar(),
    {
      provide: RICH_TEXT_EDITOR_FLOATING_TOOLBAR,
      useValue: (editor: RichTextEditorDirective) => {
        floatingToolbarSetups++;
        setupRichTextEditorFloatingToolbar(editor);
      },
    },
  ],
  template: `<et-rich-text-editor [(value)]="text" [tools]="['bold', 'italic', 'numberedList']" aria-label="Text" />`,
})
class FloatingPageComponent {
  text = signal('make this bold');
}

@Component({
  selector: 'et-scenario-static-toolbar-page',
  imports: [RICH_TEXT_EDITOR_IMPORTS, RichTextEditorFloatingToolbarComponent],
  template: `
    <et-rich-text-editor #rte="etRichTextEditor" [(value)]="text" [tools]="['bold', 'italic']" aria-label="Text" />
    <et-rich-text-editor-floating-toolbar [editor]="rte" />
  `,
})
class StaticToolbarPageComponent {
  text = signal('make this bold');
}

@Component({
  selector: 'et-scenario-layout-page',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [provideRichTextEditorAlignmentTool(), provideRichTextEditorTableTool()],
  template: `<et-rich-text-editor [(value)]="text" [tools]="['align', 'table', 'bulletedList']" aria-label="Text" />`,
})
class LayoutPageComponent {
  text = signal('Intro');
}

const failures: RichTextEditorImageFailure[] = [];
const uploads: { file: File; url$: Subject<string> }[] = [];

@Component({
  selector: 'et-scenario-image-page',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [
    provideRichTextEditorImageTool({
      upload: (file) => {
        const url$ = new Subject<string>();

        uploads.push({ file, url$ });

        return url$;
      },
      maxSize: 1000,
      onFailure: (failure) => failures.push(failure),
    }),
  ],
  template: `<et-rich-text-editor [(value)]="text" [tools]="['image']" aria-label="Text" />`,
})
class ImagePageComponent {
  text = signal('Chart');
}

@Component({
  selector: 'et-scenario-rendered-content',
  template: '',
  host: { class: 'et-rte-content' },
})
class RenderedContentComponent {
  constructor() {
    mountRichTextEditorTableStyles();
    mountRichTextEditorImageStyles();
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.innerHTML = markdownToHtml(
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n![logo](https://cdn.example.com/logo.png)',
    );
  }
}

const FIELDS = [
  { id: 'first-name', label: 'First name', description: 'The recipient first name' },
  { id: 'city', label: 'City' },
  { id: 'legacy', label: 'Legacy field', disabled: true },
];

type PeopleArgs = { response: { items: { id: string; name: string }[] }; queryParams: { q: string } };

const API = createQueryClient({ name: 'scenario-rte-api', baseUrl: 'https://api.example.com' });
const searchPeople = createGetQuery(API)<PeopleArgs>('/people');

@Component({
  selector: 'et-scenario-template-page',
  imports: [RICH_TEXT_EDITOR_IMPORTS, RICH_TEXT_EDITOR_TRIGGERS_IMPORTS, RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS],
  template: `
    <et-rich-text-editor #rte="etRichTextEditor" [(value)]="text" [triggers]="triggers" etRichTextEditorTriggers />
    <et-rich-text-editor-token-palette [editor]="rte" [triggers]="paletteTriggers" focusEditorOnInsert="false" />
  `,
})
class TemplatePageComponent {
  text = signal('');
  fieldTrigger = createRichTextEditorTrigger({
    char: '#',
    type: 'field',
    items: FIELDS,
    resolveItem: (id) => FIELDS.find((field) => field.id === id) ?? null,
  });
  peopleTrigger = createRichTextEditorTriggerWithQuery({
    char: '@',
    type: 'mention',
    queryCreator: searchPeople,
    args: (search) => (search() ? { queryParams: { q: search() } } : null),
    toItems: (response) => response.items.map((person) => ({ id: person.id, label: person.name })),
    debounceTime: 100,
  });
  triggers: RichTextEditorTrigger[] = [this.fieldTrigger, this.peopleTrigger];
  paletteTriggers: RichTextEditorTrigger[] = [this.fieldTrigger];
}

@Component({
  selector: 'et-scenario-token-preview',
  providers: [
    provideRichTextEditorTokenRendering([createRichTextEditorTrigger({ char: '#', type: 'field', items: FIELDS })]),
  ],
  template: '',
})
class TokenPreviewComponent {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const codec = inject(RICH_TEXT_EDITOR_TOKEN_CODEC);

    host.innerHTML = codec.render(markdownToHtml('Hello {{field:first-name}}'));
    codec.hydrate(host);
  }
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const textbox = (root: ParentNode) => query('[role="textbox"]', root);

const button = (label: string, root: ParentNode = document) =>
  query<HTMLButtonElement>(`button[aria-label="${label}"]`, root);

const buttonByText = (text: string, root: ParentNode = document) => {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );

  if (!found) throw new Error(`no button "${text}"`);

  return found;
};

const menuItemLabel = (item: Element) => item.textContent?.trim().split('\n')[0]?.trim();

const menuItem = (label: string) => {
  const found = Array.from(document.querySelectorAll<HTMLElement>('et-menu-radio-item')).find(
    (item) => menuItemLabel(item) === label,
  );

  if (!found) throw new Error(`no menu item "${label}"`);

  return found;
};

const fill = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

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

const press = (s: Scenario, target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

  target.dispatchEvent(event);
  s.tick();

  return event;
};

const pasteFiles = (s: Scenario, root: HTMLElement, files: File[]) => {
  const event = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clipboardData', {
    value: { files, types: ['Files'], getData: () => '' },
  });
  root.dispatchEvent(event);
  s.tick();

  return event;
};

const pasteText = (s: Scenario, root: HTMLElement, text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clipboardData', {
    value: { files: [], types: ['text/plain'], getData: (type: string) => (type === 'text/plain' ? text : '') },
  });
  root.dispatchEvent(event);
  s.tick();

  return event;
};

// jsdom moves the document selection into whatever takes focus; a browser leaves it in the editor
// when the menu focuses its first item.
const keepSelectionAcrossMenuFocus = (root: HTMLElement, offset: number) => {
  const { node, offset: nodeOffset } = textPoint(root, offset);
  const range = document.createRange();

  range.setStart(node, nodeOffset);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
};

const image = (name: string, size = 10) => new File(['x'.repeat(size)], name, { type: 'image/png' });

describe('forms rich-text-editor tool scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemesWithTailwind4(COLOR_THEMES),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });

  beforeAll(() => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
  });

  afterAll(() => {
    Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    Reflect.deleteProperty(Range.prototype, 'getClientRects');
  });

  beforeEach(() => {
    linkEditorSetups.length = 0;
    floatingToolbarSetups = 0;
    failures.length = 0;
    uploads.length = 0;
  });

  it('adds, edits and removes a link through the link editor popover', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LinkPageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;

    s.flush();

    const editable = textbox(host);

    expect(linkEditorSetups).toEqual([query('et-rich-text-editor', host)]);

    editable.focus();
    selectText(editable, 5, 9);
    button('Link', host).click();
    s.flush();

    const popover = query('et-rich-text-editor-link-editor');

    expect(popover.getAttribute('role')).toBe('dialog');
    expect(query('.et-rte-link-editor-title', popover).textContent).toBe('Add link');
    expect(query<HTMLInputElement>('input:not([type="url"])', popover).value).toBe('docs');
    expect(button('Link', host).getAttribute('aria-pressed')).toBe('true');
    expect(buttonByText('Add', popover).disabled).toBe(true);

    fill(s, query<HTMLInputElement>('input[type="url"]', popover), 'https://example.com/docs');
    buttonByText('Add', popover).click();
    s.flush();

    expect(document.querySelector('et-rich-text-editor-link-editor')).toBeNull();
    expect(text()).toBe('read [docs](https://example.com/docs)');

    selectText(editable, 6);
    button('Link', host).click();
    s.flush();

    const editPopover = query('et-rich-text-editor-link-editor');

    expect(query('.et-rte-link-editor-title', editPopover).textContent).toBe('Edit link');
    expect(query<HTMLInputElement>('input[type="url"]', editPopover).value).toBe('https://example.com/docs');

    buttonByText('Remove', editPopover).click();
    s.flush();
    expect(text()).toBe('read docs');

    selectText(editable, 0, 4);
    button('Link', host).click();
    s.flush();
    press(s, query('et-rich-text-editor-link-editor'), 'Escape');
    s.flush();
    expect(document.querySelector('et-rich-text-editor-link-editor')).toBeNull();
    expect(text()).toBe('read docs');

    selectText(editable, 0, 4);
    button('Link', host).click();
    s.flush();

    const unsafePopover = query('et-rich-text-editor-link-editor');

    fill(s, query<HTMLInputElement>('input[type="url"]', unsafePopover), 'java\tscript:steal()');
    buttonByText('Add', unsafePopover).click();
    s.flush();
    expect(document.querySelector('et-rich-text-editor-link-editor')).not.toBeNull();
    expect(editable.querySelector('a')).toBeNull();
    press(s, unsafePopover, 'Escape');
    s.flush();
    expect(text()).toBe('read docs');
  });

  it('opens a link in a new tab when the popover asks for it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LinkPageComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const editable = textbox(host);

    editable.focus();
    selectText(editable, 5, 9);
    button('Link', host).click();
    s.flush();

    const popover = query('et-rich-text-editor-link-editor');

    fill(s, query<HTMLInputElement>('input:not([type="url"])', popover), 'the docs');
    fill(s, query<HTMLInputElement>('input[type="url"]', popover), 'https://example.com/docs');
    query('et-checkbox', popover).click();
    s.tick();
    press(s, query<HTMLInputElement>('input[type="url"]', popover), 'Enter');
    s.flush();

    const link = query<HTMLAnchorElement>('a', editable);

    expect(link.textContent).toBe('the docs');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(fixture.componentInstance.text()).toContain('https://example.com/docs');
  });

  it('floats the inline marks over a selection and formats it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FloatingPageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;

    s.flush();

    const editable = textbox(host);

    expect(floatingToolbarSetups).toBe(1);

    editable.focus();
    selectText(editable, 10, 14);
    editable.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    s.flush();

    const toolbar = query('et-rich-text-editor-floating-toolbar');

    expect(toolbar.getAttribute('role')).toBe('toolbar');
    expect(toolbar.getAttribute('aria-label')).toBe('Selection formatting');
    expect(Array.from(toolbar.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bold',
      'Italic',
    ]);

    button('Bold', toolbar).click();
    s.tick();
    expect(text()).toBe('make this **bold**');
    expect(button('Bold', toolbar).getAttribute('aria-pressed')).toBe('true');

    selectText(editable, 2);
    editable.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
    s.flush();
    expect(document.querySelector('et-rich-text-editor-floating-toolbar')).toBeNull();
  });

  it('wires the link popover and the selection toolbar through directives instead of providers', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(DirectiveToolsPageComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const editable = textbox(host);

    editable.focus();
    selectText(editable, 0, 5);
    editable.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
    s.flush();

    const toolbar = query('et-rich-text-editor-floating-toolbar');

    expect(Array.from(toolbar.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bold',
      'Link',
    ]);

    button('Link', toolbar).click();
    s.flush();

    const popover = query('et-rich-text-editor-link-editor');

    fill(s, query<HTMLInputElement>('input[type="url"]', popover), 'https://example.com');
    buttonByText('Add', popover).click();
    s.flush();
    expect(fixture.componentInstance.text()).toBe('[plain](https://example.com) words');

    editable.blur();
    s.flush();
    expect(document.querySelector('et-rich-text-editor-floating-toolbar')).toBeNull();
  });

  it('aligns blocks through the alignment menu and builds a table from the size picker', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LayoutPageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;

    s.flush();

    const editable = textbox(host);

    expect(fixture.debugElement.query(By.directive(RichTextEditorAlignToolComponent))).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(RichTextEditorTableToolComponent))).not.toBeNull();

    editable.focus();
    selectText(editable, 2);
    button('Text alignment', host).click();
    s.flush();

    expect(Array.from(document.querySelectorAll('et-menu-radio-item')).map(menuItemLabel)).toEqual(
      TEXT_ALIGNS.map((align) => (align === 'justify' ? 'Justify' : `Align ${align}`)),
    );

    keepSelectionAcrossMenuFocus(editable, 2);
    menuItem('Align center').click();
    s.flush();
    expect(editable.querySelector('p.et-rte-align-center')?.textContent).toBe('Intro');
    expect(text()).toContain('et-rte-align-center');

    selectText(editable, 5);
    button('Table', host).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    button('Table', host).click();
    s.flush();

    button('2 by 3').click();
    s.flush();

    const table = query<HTMLTableElement>('table', editable);

    expect(table.rows.length).toBe(2);
    expect(table.rows[0]?.cells.length).toBe(3);
    expect(text()).toMatch(/\|.*\|.*\|.*\|/);

    const firstCell = table.rows[0]!.cells[0]!;

    caretInEmpty(firstCell);
    const tab = press(s, editable, 'Tab');

    expect(tab.defaultPrevented).toBe(true);
    expect(table.rows[0]!.cells[1]!.contains(document.getSelection()!.anchorNode)).toBe(true);

    button('Table', host).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    button('Table', host).click();
    s.flush();
    buttonByText('Insert row below').click();
    s.flush();
    expect(query<HTMLTableElement>('table', editable).rows.length).toBe(3);
  });

  it('uploads a pasted image into a placeholder, then embeds it and edits its alt text', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ImagePageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;

    s.flush();

    const editable = textbox(host);

    expect(fixture.debugElement.query(By.directive(RichTextEditorImageToolComponent))).not.toBeNull();

    editable.focus();
    selectText(editable, 5);
    expect(pasteFiles(s, editable, [image('chart.png')]).defaultPrevented).toBe(true);

    const placeholder = query('.et-rte-image-upload', editable);

    expect(placeholder.getAttribute('aria-label')).toBe('Uploading image…');
    expect(uploads.map((upload) => upload.file.name)).toEqual(['chart.png']);
    expect(text()).toBe('Chart');

    uploads[0]!.url$.next('https://cdn.example.com/chart.png');
    s.tick();
    expect(editable.querySelector('.et-rte-image-upload')).toBeNull();
    expect(text()).toContain('![](https://cdn.example.com/chart.png)');

    query<HTMLImageElement>('img', editable).click();
    s.flush();

    const popover = query('et-rich-text-editor-image-editor');

    expect(query('.et-rte-image-editor-file', popover).textContent).toBe('chart.png');

    fill(s, query<HTMLInputElement>('input', popover), 'Sales chart');
    buttonByText('Update', popover).click();
    s.flush();
    expect(text()).toContain('![Sales chart](https://cdn.example.com/chart.png)');

    query<HTMLImageElement>('img', editable).click();
    s.flush();
    buttonByText('Remove', query('et-rich-text-editor-image-editor')).click();
    s.flush();
    expect(editable.querySelector('img')).toBeNull();
    expect(text()).toBe('Chart');
  });

  it('reports images that are too large or fail to upload, and picks files from the toolbar', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ImagePageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;

    s.flush();

    const editable = textbox(host);

    editable.focus();
    selectText(editable, 5);
    pasteFiles(s, editable, [image('huge.png', 5000)]);
    expect(failures.map((failure) => [failure.file.name, failure.reason])).toEqual([['huge.png', 'too-large']]);
    expect(uploads).toEqual([]);

    pasteFiles(s, editable, [image('broken.png')]);
    uploads[0]!.url$.error(new Error('Storage is full'));
    s.tick();

    const placeholder = query('.et-rte-image-upload', editable);

    expect(placeholder.getAttribute('data-state')).toBe('error');
    expect(placeholder.getAttribute('aria-label')).toBe('Image upload failed');
    expect(failures[1]).toMatchObject({ reason: 'upload-failed', message: 'Storage is full' });

    s.tick(4000);
    expect(editable.querySelector('.et-rte-image-upload')).toBeNull();
    expect(text()).toBe('Chart');

    selectText(editable, 5);
    button('Image', host).click();
    s.tick();

    const picker = query<HTMLInputElement>('input[type="file"]', document.body);

    expect(picker.getAttribute('accept')).toBe('image/*');
    Object.defineProperty(picker, 'files', { value: [image('picked.png')] });
    picker.dispatchEvent(new Event('change'));
    s.tick();
    expect(document.body.querySelector('input[type="file"]')).toBeNull();
    uploads[1]!.url$.next('https://cdn.example.com/picked.png');
    s.tick();
    expect(text()).toContain('![](https://cdn.example.com/picked.png)');
  });

  it('runs a single upload outside the editor and reports its outcome', async () => {
    const s = scenario();
    const events: string[] = [];

    startImageUpload({
      file: image('avatar.png'),
      upload: () => Promise.resolve('https://cdn.example.com/avatar.png'),
      injector: s.injector,
      onProgress: (percentage) => events.push(`progress ${percentage}`),
      onSuccess: (url) => events.push(`success ${url}`),
      onError: (_, message) => events.push(`error ${message}`),
    });
    const failed = startImageUpload({
      file: image('late.png'),
      upload: () => new Promise<string>(() => undefined),
      injector: s.injector,
      onProgress: () => undefined,
      onSuccess: () => events.push('late success'),
      onError: () => events.push('late error'),
    });

    failed.cancel();
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toContain('success https://cdn.example.com/avatar.png');
    expect(events).not.toContain('late success');
  });

  it('styles table and image content rendered outside the editor', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RenderedContentComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    expect(host.querySelector('table')).not.toBeNull();
    expect(query<HTMLImageElement>('img', host).getAttribute('src')).toBe('https://cdn.example.com/logo.png');
    expect(RichTextEditorTableStylesComponent).toBeDefined();
    expect(RichTextEditorImageStylesComponent).toBeDefined();
  });

  it('inserts tokens from the trigger popup, the palette and pasted text', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TemplatePageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;

    s.tick();

    const editable = textbox(host);

    expect(fixture.debugElement.query(By.directive(RichTextEditorTriggersDirective))).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(RichTextEditorTokenPaletteComponent))).not.toBeNull();

    editable.focus();
    caretInEmpty(editable);
    typeText(s, editable, 'Dear #cit');
    s.tick(200);

    const popup = query('et-rich-text-editor-token-popup');
    const options = () => Array.from(popup.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim());

    expect(options()).toEqual(['City']);
    expect(editable.getAttribute('aria-expanded') ?? 'true').toBe('true');

    press(s, editable, 'Enter');
    s.tick();
    expect(document.querySelector('et-rich-text-editor-token-popup')).toBeNull();
    expect(query('[data-et-token]', editable).textContent).toContain('City');
    expect(text()).toBe('Dear {{field:city}}');

    const palette = query('et-rte-token-palette, et-rich-text-editor-token-palette', host);

    expect(palette.getAttribute('aria-label')).toBe('Insert token');
    const chips = Array.from(palette.querySelectorAll('button'));

    expect(chips.map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '# First name',
      '# City',
      '# Legacy field',
    ]);
    expect(chips.map((chip) => chip.disabled)).toEqual([false, false, true]);
    expect(chips.map((chip) => chip.getAttribute('title'))).toEqual(['The recipient first name', null, null]);

    chips[0]!.click();
    s.tick();
    expect(text()).toBe('Dear {{field:city}} {{field:first-name}}');

    const pasted = pasteText(s, editable, 'from #City');

    expect(pasted.defaultPrevented).toBe(true);
    expect(text()).toBe('Dear {{field:city}} {{field:first-name}} from {{field:city}}');
    expect(editable.querySelectorAll('[data-et-token]').length).toBe(3);
    s.flush();
  });

  it('stores a token whose id holds Markdown characters verbatim and renders it as a chip again', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TemplatePageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;
    const token = '{{field:_first_name}}';

    text.set(token);
    s.tick();

    const editable = textbox(host);
    const palette = query('et-rte-token-palette, et-rich-text-editor-token-palette', host);

    palette.querySelector('button')!.click();
    s.tick();

    const stored = text();

    expect(stored).toBe(`${token}\n{{field:first-name}}`);

    text.set('');
    s.tick();
    text.set(stored);
    s.tick();
    expect(
      Array.from(editable.querySelectorAll('[data-et-token]')).map((chip) => chip.getAttribute('data-token-id')),
    ).toEqual(['_first_name', 'first-name']);
    s.flush();
  });

  it('searches people through a query-backed trigger', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TemplatePageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.componentInstance.text;

    s.tick();

    const editable = textbox(host);

    editable.focus();
    caretInEmpty(editable);
    typeText(s, editable, '@ad');
    s.tick(150);
    const requests = http.match((request) => request.url.startsWith('https://api.example.com/people'));

    expect(requests.map((request) => [request.request.urlWithParams, request.cancelled])).toEqual([
      ['https://api.example.com/people?q=a', true],
      ['https://api.example.com/people?q=ad', false],
    ]);
    requests[1]!.flush({ items: [{ id: 'ada', name: 'Ada Lovelace' }] });
    s.tick();

    const popup = query('et-rich-text-editor-token-popup');

    expect(Array.from(popup.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim())).toEqual([
      'Ada Lovelace',
    ]);

    press(s, editable, 'Enter');
    s.tick();
    expect(text()).toBe('{{mention:ada}}');
    http.verify();
    s.flush();
  });

  it('renders the stock popover pieces on their own for an app that wires them itself', () => {
    const s = scenario();
    const page = TestBed.createComponent(StaticToolbarPageComponent);
    const host = page.nativeElement as HTMLElement;

    s.flush();

    const editable = textbox(host);
    const toolbar = query('et-rich-text-editor-floating-toolbar', host);

    expect(Array.from(toolbar.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bold',
      'Italic',
    ]);

    editable.focus();
    selectText(editable, 0, 4);
    button('Italic', toolbar).click();
    s.tick();
    expect(page.componentInstance.text()).toBe('*make* this bold');
    expect(button('Italic', toolbar).getAttribute('aria-pressed')).toBe('true');

    const saved: unknown[] = [];
    const link = TestBed.createComponent(RichTextEditorLinkEditorComponent);

    link.componentRef.setInput('labels', DEFAULT_RICH_TEXT_EDITOR_LABELS);
    link.componentRef.setInput('href', 'https://example.com');
    link.componentRef.setInput('text', 'Example');
    link.componentRef.setInput('exists', true);
    link.componentInstance.saveLink.subscribe((value) => saved.push(value));
    link.componentInstance.removeLink.subscribe(() => saved.push('remove'));
    link.componentInstance.dismiss.subscribe(() => saved.push('dismiss'));
    s.tick();
    fill(s, query<HTMLInputElement>('input[type="url"]', link.nativeElement), '  https://example.org  ');
    buttonByText('Update', link.nativeElement).click();
    buttonByText('Remove', link.nativeElement).click();
    button('Close', link.nativeElement).click();
    expect(saved).toEqual([{ href: 'https://example.org', text: 'Example', newTab: false }, 'remove', 'dismiss']);

    const alts: string[] = [];
    const imageEditor = TestBed.createComponent(RichTextEditorImageEditorComponent);

    imageEditor.componentRef.setInput('labels', DEFAULT_RICH_TEXT_EDITOR_LABELS);
    imageEditor.componentRef.setInput('src', 'https://cdn.example.com/a%20b.png?v=2');
    imageEditor.componentInstance.saveAlt.subscribe((alt) => alts.push(alt));
    s.tick();
    expect(query('.et-rte-image-editor-file', imageEditor.nativeElement).textContent).toBe('a b.png');
    fill(s, query<HTMLInputElement>('input', imageEditor.nativeElement), ' Diagram ');
    press(s, query<HTMLInputElement>('input', imageEditor.nativeElement), 'Enter');
    expect(alts).toEqual(['Diagram']);

    const picked: string[] = [];
    const popup = TestBed.createComponent(RichTextEditorTokenPopupComponent);

    popup.componentRef.setInput('items', FIELDS);
    popup.componentRef.setInput('activeIndex', 1);
    popup.componentRef.setInput('emptyLabel', 'Nothing found');
    popup.componentRef.setInput('listboxId', 'fields-listbox');
    popup.componentInstance.selectItem.subscribe((item) => picked.push(item.id));
    s.tick();

    const options = Array.from(popup.nativeElement.querySelectorAll('[role="option"]')) as HTMLElement[];

    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    options[1]!.click();
    expect(picked).toEqual(['city']);

    popup.componentRef.setInput('items', []);
    popup.componentRef.setInput('error', 'Search is down');
    s.tick();
    expect(query('[role="alert"]', popup.nativeElement).textContent).toContain('Search is down');
    popup.destroy();
    popup.nativeElement.remove();
    s.flush();
  });

  it('renders stored tokens as chips in an app-built preview', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TokenPreviewComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(query('[data-et-token]', host).textContent).toContain('First name');
    expect(host.textContent).toContain('Hello');
  });
});
