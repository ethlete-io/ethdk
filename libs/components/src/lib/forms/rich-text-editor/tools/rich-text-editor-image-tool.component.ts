import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { IconDirective, IMAGE_ICON, provideIcons } from '../../../icon';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { richTextEditorToolLabel } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL } from '../rich-text-editor-tools';

/**
 * The opt-in image tool's toolbar button. It exists so the tool's icon is registered here rather than
 * in the editor's own `provideIcons` - an editor without the image tool then ships neither.
 *
 * The behavior lives on the tool definition (`provideRichTextEditorImageTool`), which this looks up
 * through DI: pressing the button inserts an image, or opens the popover of the one at the caret.
 */
@Component({
  selector: 'et-rich-text-editor-image-tool',
  template: `
    <button
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      (mousedown)="$event.preventDefault()"
      (click)="run()"
      et-icon-button
      size="sm"
      type="button"
      color="surface"
      pressedColor="inherit"
    >
      <i etIcon="et-image"></i>
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, IconDirective],
  providers: [provideIcons(IMAGE_ICON)],
  host: { class: 'et-rte-image-tool' },
})
export class RichTextEditorImageToolComponent {
  private tools = inject(RICH_TEXT_EDITOR_TOOL);

  public editor = input.required<RichTextEditorDirective>();

  private definition = computed(() => this.tools.find((tool) => tool.token === 'image') ?? null);

  protected label = computed(() => {
    const definition = this.definition();

    return definition ? richTextEditorToolLabel(this.editor().resolvedLabels(), definition) : '';
  });

  protected disabled = computed(() => {
    const editor = this.editor();

    return editor.disabled() || editor.readonly() || (this.definition()?.isDisabled?.(editor) ?? false);
  });

  protected run() {
    this.definition()?.run?.(this.editor());
  }
}
