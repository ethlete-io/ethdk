import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { RichTextEditorDirective } from './headless';
import { provideRichTextEditorLinkEditor } from './rich-text-editor-link-editor.provider';
import { RichTextEditorComponent } from './rich-text-editor.component';

@Component({
  template: `<et-rich-text-editor />`,
  imports: [RichTextEditorComponent],
})
class EditorTestHost {}

const editorDirectiveOf = (fixture: ComponentFixture<EditorTestHost>) =>
  (fixture.debugElement.children[0] as DebugElement).injector.get(RichTextEditorDirective);

describe('rich text editor link editor', () => {
  describe('without provideRichTextEditorLinkEditor', () => {
    let fixture: ComponentFixture<EditorTestHost>;
    let dir: RichTextEditorDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [EditorTestHost] });
      fixture = TestBed.createComponent(EditorTestHost);
      fixture.detectChanges();
      dir = editorDirectiveOf(fixture);
    });

    it('should register no popover opener', () => {
      expect(dir.openLinkEditor()).toBeNull();
    });

    it('should fall back to the native prompt', () => {
      const prompt = vi.fn().mockReturnValue('https://ethlete.io');
      vi.spyOn(window, 'prompt').mockImplementation(prompt);

      dir.promptForLink();

      expect(prompt).toHaveBeenCalledOnce();
      expect(dir.linkEditorOpen()).toBe(false);
    });
  });

  describe('with provideRichTextEditorLinkEditor', () => {
    let fixture: ComponentFixture<EditorTestHost>;
    let dir: RichTextEditorDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [EditorTestHost],
        providers: [provideRichTextEditorLinkEditor()],
      });
      fixture = TestBed.createComponent(EditorTestHost);
      fixture.detectChanges();
      dir = editorDirectiveOf(fixture);
    });

    it('should register the popover opener', () => {
      expect(dir.openLinkEditor()).toBeInstanceOf(Function);
    });

    it('should open the popover instead of the native prompt', () => {
      const prompt = vi.fn();
      vi.spyOn(window, 'prompt').mockImplementation(prompt);
      const open = vi.fn();
      dir.openLinkEditor.set(open);

      dir.promptForLink();

      expect(open).toHaveBeenCalledOnce();
      expect(prompt).not.toHaveBeenCalled();
    });
  });
});
