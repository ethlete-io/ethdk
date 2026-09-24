import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { RICH_TEXT_EDITOR_IMPORTS } from './rich-text-editor.imports';
import { provideRichTextEditorTokenRendering } from './rich-text-editor-token-providers';
import { RichTextViewerComponent } from './rich-text-viewer.component';
import { provideRichTextEditorDefaultTools } from './tools/rich-text-editor-default-tools.provider';

@Component({
  selector: 'et-viewer-test-host',
  template: `<et-rich-text-viewer [value]="value()" />`,
  imports: [RichTextViewerComponent],
})
class ViewerTestHost {
  public value = signal<string | null>('');
}

@Component({
  selector: 'et-token-viewer-test-host',
  template: `<et-rich-text-viewer [value]="value()" />`,
  imports: [RichTextViewerComponent],
  providers: [
    provideRichTextEditorTokenRendering([
      { char: '#', type: 'block', items: [{ id: 'firstName', label: 'First <b>name</b>' }] },
    ]),
  ],
})
class TokenViewerTestHost {
  public value = signal('Hello {{block:firstName}}');
}

@Component({
  selector: 'et-editor-test-host',
  template: `<et-rich-text-editor [value]="value" />`,
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [provideRichTextEditorDefaultTools()],
})
class EditorTestHost {
  public value = '';
}

const renderViewer = <T extends ViewerTestHost | TokenViewerTestHost>(host: new () => T, value?: string | null) => {
  const fixture = TestBed.createComponent(host);

  if (value !== undefined) fixture.componentInstance.value.set(value as string);

  fixture.detectChanges();

  const viewer = (fixture.nativeElement as HTMLElement).querySelector('et-rich-text-viewer') as HTMLElement;

  return { fixture, viewer };
};

describe('RichTextViewerComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders a value exactly like the editor content area does', async () => {
    const value =
      '# Title\n\nSome **bold**, *italic*, <u>under</u> and `code`.\n\n- one\n  - nested\n\n> quote\n\n```\nconst a = 1;\n```\n\n| A | B |\n| :--- | ---: |\n| 1 | 2 |\n\n[link](https://example.com)';

    const editorFixture = TestBed.createComponent(EditorTestHost);

    editorFixture.componentInstance.value = value;
    editorFixture.detectChanges();
    await editorFixture.whenStable();

    const editable = (editorFixture.nativeElement as HTMLElement).querySelector('.et-rte-content') as HTMLElement;
    const { viewer } = renderViewer(ViewerTestHost, value);

    expect(viewer.innerHTML).toContain('<h1>Title</h1>');
    expect(viewer.innerHTML).toBe(editable.innerHTML);
  });

  it('shares the content styles with the editor instead of carrying its own copy', async () => {
    const editorFixture = TestBed.createComponent(EditorTestHost);

    editorFixture.detectChanges();
    await editorFixture.whenStable();

    expect(document.querySelectorAll('et-rich-text-content-styles')).toHaveLength(1);

    const { viewer } = renderViewer(ViewerTestHost, 'text');

    expect(viewer.classList).toContain('et-rte-content');
    expect(document.querySelectorAll('et-rich-text-content-styles')).toHaveLength(1);
  });

  it('mounts the table and image styles only for content that has a table or an image', () => {
    const { fixture } = renderViewer(ViewerTestHost, 'Plain <table> text');

    expect(document.querySelector('et-rich-text-editor-table-styles')).toBeNull();
    expect(document.querySelector('et-rich-text-editor-image-styles')).toBeNull();

    fixture.componentInstance.value.set('| A |\n| --- |\n| 1 |\n\n![alt](https://example.com/a.png)');
    fixture.detectChanges();

    expect(document.querySelector('et-rich-text-editor-table-styles')).not.toBeNull();
    expect(document.querySelector('et-rich-text-editor-image-styles')).not.toBeNull();
  });

  it('escapes raw HTML and drops unsafe URLs', () => {
    const { viewer } = renderViewer(
      ViewerTestHost,
      [
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(1)">',
        '[click](javascript:alert(1)) and ![pic](javascript:alert(1))',
        '<a href="javascript:alert(1)" target="_blank">new tab</a>',
        '<p style="text-align: center" onclick="alert(1)">centered <img src=x onerror=alert(1)><script>alert(1)</script></p>',
        '![a" onerror="alert(1)](https://example.com/a.png)',
      ].join('\n\n'),
    );

    expect(viewer.querySelector('script')).toBeNull();
    expect(viewer.querySelector('[onerror], [onclick]')).toBeNull();
    expect(viewer.querySelector('[href^="javascript:" i], [src^="javascript:" i]')).toBeNull();
    expect(viewer.querySelectorAll('img')).toHaveLength(1);
    expect(viewer.textContent).toContain('<script>alert(1)</script>');
    expect(viewer.querySelector('[style]')).toBeNull();
    expect(viewer.querySelector('p.et-rte-align-center')?.textContent).toContain('centered');
  });

  it('re-renders when the value changes and renders nothing for an empty value', () => {
    const { fixture, viewer } = renderViewer(ViewerTestHost, '**first**');

    expect(viewer.innerHTML).toBe('<p><strong>first</strong></p>');

    fixture.componentInstance.value.set(null);
    fixture.detectChanges();

    expect(viewer.innerHTML).toBe('');
  });

  it('renders stored tokens as chips with an escaped label when token rendering is provided', () => {
    const { viewer } = renderViewer(TokenViewerTestHost);

    const chip = viewer.querySelector('.et-rte-token');

    expect(chip?.getAttribute('data-token-id')).toBe('firstName');
    expect(chip?.querySelector('.et-rte-token-label')?.textContent).toBe('First <b>name</b>');
    expect(chip?.querySelector('b')).toBeNull();
  });

  it('keeps token markdown as text without token rendering', () => {
    const { viewer } = renderViewer(ViewerTestHost, 'Hello {{block:firstName}}');

    expect(viewer.querySelector('.et-rte-token')).toBeNull();
    expect(viewer.textContent).toBe('Hello {{block:firstName}}');
  });
});
