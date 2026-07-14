import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, effect, ElementRef, inject, viewChild, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { markdownToHtml } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { IconButtonComponent } from '../../button/icon-button.component';
import {
  BOLD_ICON,
  HEADING_1_ICON,
  HEADING_2_ICON,
  HEADING_3_ICON,
  IconDirective,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  provideIcons,
  STRIKETHROUGH_ICON,
} from '../../icon';
import { RichTextEditorDirective } from './headless';
import { RichTextEditorFloatingToolbarComponent } from './rich-text-editor-floating-toolbar.component';

@Component({
  selector: 'et-rich-text-editor',
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconButtonComponent, IconDirective, RichTextEditorFloatingToolbarComponent],
  providers: [
    provideIcons(
      BOLD_ICON,
      ITALIC_ICON,
      STRIKETHROUGH_ICON,
      HEADING_1_ICON,
      HEADING_2_ICON,
      HEADING_3_ICON,
      LIST_BULLETED_ICON,
      LIST_NUMBERED_ICON,
      LINK_ICON,
    ),
  ],
  hostDirectives: [
    {
      directive: RichTextEditorDirective,
      inputs: ['value', 'disabled', 'readonly', 'hidden', 'invalid', 'errors', 'required', 'name', 'placeholder'],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-rich-text-editor',
    '(click)': 'dir.activate()',
  },
})
export class RichTextEditorComponent {
  protected dir = inject(RichTextEditorDirective);

  private document = inject(DOCUMENT);
  private editable = viewChild.required<ElementRef<HTMLElement>>('editable');

  constructor() {
    afterNextRender(() => {
      this.dir.editorDom.root.set(this.editable().nativeElement ?? null);
      this.renderExternalValue();
    });

    fromEvent(this.document, 'selectionchange')
      .pipe(
        tap(() => this.dir.refreshActiveMarks()),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Render programmatic (external) value changes into the DOM. Skip the user's own edits -
    // those already match `lastEmittedMarkdown`, so re-rendering would reset the caret.
    effect(() => {
      const markdown = this.dir.value();

      if (markdown === this.dir.lastEmittedMarkdown) return;

      this.renderExternalValue(markdown);
    });
  }

  protected syncValueFromDom() {
    this.dir.syncFromDom();
  }

  protected interceptBackspaceKey(event: KeyboardEvent) {
    if (event.key !== 'Backspace') return;

    if (this.dir.handleBackspace()) {
      event.preventDefault();
    }
  }

  protected interceptFormattingCommand(event: InputEvent) {
    // Keep keyboard shortcuts (Ctrl/Cmd+B, …) running through our Selection/Range commands
    // instead of the browser's deprecated execCommand-backed formatting.
    switch (event.inputType) {
      case 'formatBold':
        event.preventDefault();
        this.dir.toggleBold();
        break;
      case 'formatItalic':
        event.preventDefault();
        this.dir.toggleItalic();
        break;
      case 'formatStrikeThrough':
        event.preventDefault();
        this.dir.toggleStrikethrough();
        break;
    }
  }

  private renderExternalValue(markdown = this.dir.value()) {
    const el = this.editable()?.nativeElement;

    if (!el) return;

    const codec = this.dir.tokenCodec();
    const html = markdownToHtml(markdown);

    el.innerHTML = codec ? codec.render(html) : html;
    codec?.hydrate(el);
    this.dir.lastEmittedMarkdown = markdown;
  }
}
