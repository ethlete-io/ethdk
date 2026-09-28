import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { RichTextEditorDirective } from './headless';
import {
  RichTextEditorLinkEditorComponent,
  RichTextEditorLinkEditorValue,
} from './rich-text-editor-link-editor.component';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from './rich-text-editor-labels';
import { provideRichTextEditorLinkEditor } from './rich-text-editor-link-editor.provider';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { provideRichTextEditorLinkTool } from './tools/rich-text-editor-link.provider';

@Component({
  template: `<et-rich-text-editor />`,
  imports: [RichTextEditorComponent],
  // The popover is a second opt-in on top of the link tool - what these specs vary is the popover.
  providers: [provideRichTextEditorLinkTool()],
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

  describe('the popover URL field', () => {
    let fixture: ComponentFixture<RichTextEditorLinkEditorComponent>;
    let saved: RichTextEditorLinkEditorValue[];

    const urlInput = () => fixture.nativeElement.querySelector('input[type="url"]') as HTMLInputElement;
    const addButton = () =>
      fixture.nativeElement.querySelector('.et-rte-link-editor-actions button') as HTMLButtonElement;

    const typeUrl = (url: string) => {
      urlInput().value = url;
      urlInput().dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    };

    const pressEnter = () => {
      urlInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
    };

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [RichTextEditorLinkEditorComponent],
        providers: [provideColorThemes(TEST_COLOR_THEMES)],
      });
      fixture = TestBed.createComponent(RichTextEditorLinkEditorComponent);
      fixture.componentRef.setInput('labels', DEFAULT_RICH_TEXT_EDITOR_LABELS);
      saved = [];
      fixture.componentInstance.saveLink.subscribe((value) => saved.push(value));
      fixture.detectChanges();
    });

    it('disables Add and shows an error for a scheme it refuses', () => {
      typeUrl('javascript:alert(1)');

      expect(addButton().disabled).toBe(true);

      pressEnter();

      expect(saved).toEqual([]);
      expect(fixture.nativeElement.textContent).toContain(DEFAULT_RICH_TEXT_EDITOR_LABELS.linkUrlUnsupported);
    });

    it('links a bare domain over https', () => {
      typeUrl('www.example.com/page');

      expect(addButton().disabled).toBe(false);

      pressEnter();

      expect(saved).toEqual([{ href: 'https://www.example.com/page', text: '', newTab: false }]);
    });

    it('keeps a relative path as written', () => {
      typeUrl('/docs/start');
      pressEnter();

      expect(saved.map((value) => value.href)).toEqual(['/docs/start']);
    });
  });
});
