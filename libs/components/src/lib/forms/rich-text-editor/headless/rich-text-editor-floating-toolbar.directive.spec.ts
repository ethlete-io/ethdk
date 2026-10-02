import { Component } from '@angular/core';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { provideOverlay } from '../../../overlay/overlay.imports';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';
import { tick } from '../../../testing/driver-core';
import { mountRichTextEditor, RichTextEditorDriver } from '../../testing/rich-text-editor-driver';
import { RichTextEditorFloatingToolbarDirective } from './rich-text-editor-floating-toolbar.directive';
import { RichTextEditorDirective } from './rich-text-editor.directive';

@Component({
  template: `<div [tools]="['bold', 'italic']" etRichTextEditor etRichTextEditorFloatingToolbar></div>`,
  imports: [RichTextEditorDirective, RichTextEditorFloatingToolbarDirective],
})
class FloatingToolbarTestHost {}

const toolbar = () => document.querySelector('et-rich-text-editor-floating-toolbar');

const mockPointer = (coarse: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: coarse && query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );

describe('RichTextEditorFloatingToolbarDirective', () => {
  let driver: RichTextEditorDriver<FloatingToolbarTestHost>;

  const mount = () => {
    driver = mountRichTextEditor(FloatingToolbarTestHost, { attachEditable: true }, [
      provideOverlay(),
      provideColorThemes(TEST_COLOR_THEMES),
    ]);
    driver.setHtml('<p>make this bold</p>');
    driver.focus();
    driver.editor.focused.set(true);
  };

  const evaluate = () => {
    driver.editable().dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    tick();
  };

  beforeEach(() => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    Reflect.deleteProperty(Range.prototype, 'getClientRects');
    vi.restoreAllMocks();
  });

  it('shows on a non-collapsed selection inside the editor', () => {
    mount();
    expect(toolbar()).toBeNull();

    driver.selectText(10, 14);
    evaluate();

    expect(toolbar()).not.toBeNull();
  });

  it('stays hidden for a collapsed caret', () => {
    mount();
    driver.caretAt(4);
    evaluate();

    expect(toolbar()).toBeNull();
  });

  it('hides when the selection collapses', () => {
    mount();
    driver.selectText(10, 14);
    evaluate();
    expect(toolbar()).not.toBeNull();

    driver.caretAt(2);
    evaluate();

    expect(toolbar()).toBeNull();
  });

  it('hides when the editor blurs', () => {
    mount();
    driver.selectText(10, 14);
    evaluate();
    expect(toolbar()).not.toBeNull();

    driver.editor.focused.set(false);
    driver.blur();

    expect(toolbar()).toBeNull();
  });

  it('does not show on touch input', () => {
    mockPointer(true);
    mount();

    driver.selectText(10, 14);
    evaluate();

    expect(toolbar()).toBeNull();
  });
});
