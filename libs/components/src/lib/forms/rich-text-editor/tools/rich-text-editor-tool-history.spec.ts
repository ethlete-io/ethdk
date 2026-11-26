import { Component, DebugElement, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { RichTextEditorAlignToolComponent } from './rich-text-editor-align-tool.component';
import { provideRichTextEditorAlignmentTool } from './rich-text-editor-align.provider';
import { provideRichTextEditorDefaultTools } from './rich-text-editor-default-tools.provider';
import { RichTextEditorTableToolComponent } from './rich-text-editor-table-tool.component';
import { provideRichTextEditorTableTool } from './rich-text-editor-table.provider';

@Component({
  template: `<div etRichTextEditor></div>`,
  imports: [RichTextEditorDirective],
  providers: [
    provideRichTextEditorDefaultTools(),
    provideRichTextEditorTableTool(),
    provideRichTextEditorAlignmentTool(),
  ],
})
class EditorTestHost {}

/**
 * A tool's edit must be its own undo entry: without a boundary the commit leaves the typing burst
 * open, so the next keystroke within the coalesce window replaces the tool's entry instead of
 * pushing a new one - one undo would then take the tool's edit back along with the keystroke.
 */
describe('rich text editor tools and the undo stack', () => {
  let dir: RichTextEditorDirective;
  let editable: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EditorTestHost] });
    const fixture = TestBed.createComponent(EditorTestHost);
    fixture.detectChanges();
    dir = (fixture.debugElement.children[0] as DebugElement).injector.get(RichTextEditorDirective);

    editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.appendChild(editable);
    dir.editorDom.root.set(editable);
  });

  afterEach(() => {
    editable.remove();
    document.getSelection()?.removeAllRanges();
  });

  const caretIn = (target: Node, offset = 0) => {
    const range = document.createRange();
    range.setStart(target, offset);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  /** Types one non-whitespace character into the editor's first paragraph, like the input handler. */
  const typeChar = () => {
    const paragraph = editable.querySelector('p') as HTMLElement;
    const text = paragraph.firstChild as Text;

    text.data += 'X';
    caretIn(text, text.data.length);
    dir.syncFromDom();
  };

  const seedParagraph = () => {
    editable.innerHTML = '<p>hello</p>';
    const text = (editable.querySelector('p') as HTMLElement).firstChild as Text;
    caretIn(text, text.data.length);
    dir.syncFromDom();
  };

  const createTool = <T>(type: Type<T>): T => {
    const fixture = TestBed.createComponent(type);
    fixture.componentRef.setInput('editor', dir);
    fixture.detectChanges();

    return fixture.componentInstance;
  };

  it('keeps a table insert out of the following keystroke', () => {
    seedParagraph();
    const tool = createTool(RichTextEditorTableToolComponent);

    tool.insert(0, 0);
    expect(editable.querySelector('table')).toBeTruthy();

    typeChar();
    dir.undo();

    expect(editable.querySelector('table')).toBeTruthy();
  });

  it('keeps a row insert out of the following keystroke', () => {
    editable.innerHTML = '<p>hello</p><table><tbody><tr><td>a</td></tr></tbody></table>';
    caretIn((editable.querySelector('td') as HTMLElement).firstChild as Text, 1);
    dir.syncFromDom();

    const tool = createTool(RichTextEditorTableToolComponent);

    (tool as unknown as { addRow: (position: 'above' | 'below') => void }).addRow('below');
    expect(editable.querySelectorAll('tr')).toHaveLength(2);

    typeChar();
    dir.undo();

    expect(editable.querySelectorAll('tr')).toHaveLength(2);
  });

  it('keeps an alignment change out of the following keystroke', () => {
    seedParagraph();
    const tool = createTool(RichTextEditorAlignToolComponent);

    (tool as unknown as { select: (value: string) => void }).select('center');
    expect(dir.value()).toContain('center');

    typeChar();
    dir.undo();

    expect(dir.value()).toContain('center');
  });
});
