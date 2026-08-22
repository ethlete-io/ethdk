import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { FORM_FIELD_IMPORTS } from '../form-field/form-field.imports';
import { RICH_TEXT_EDITOR_IMPORTS } from './rich-text-editor.imports';

@Component({
  template: `
    <et-form-field>
      <et-label>Description</et-label>
      <et-rich-text-editor required />
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS],
})
class RequiredEditorTestHost {}

describe('RichTextEditorComponent', () => {
  it('announces that a required editor is required', () => {
    TestBed.configureTestingModule({
      imports: [RequiredEditorTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(RequiredEditorTestHost);

    fixture.detectChanges();

    const editable = (fixture.nativeElement as HTMLElement).querySelector('[role="textbox"]');

    expect(editable?.getAttribute('aria-required')).toBe('true');
  });
});
